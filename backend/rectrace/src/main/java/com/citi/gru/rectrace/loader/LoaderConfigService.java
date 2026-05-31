package com.citi.gru.rectrace.loader;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;

import com.citi.gru.rectrace.loader.dto.LoaderConfigV4;
import com.citi.gru.rectrace.loader.dto.LoaderJobDefV4;
import com.fasterxml.jackson.databind.ObjectMapper;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

/**
 * Phase 6 / LOADER-01 — loads {@code loader-config-v4.json} at boot and fails loud on any
 * structural defect (duplicate job key, blank schedule, unparseable cron, unknown ES alias).
 *
 * <p>Mirrors the {@code @PostConstruct} pattern from {@code SearchConfigServiceV4} and adds
 * the three loader-specific validations called out in the plan's interfaces:
 * <ol>
 *   <li>Reject duplicate {@code key} across jobs.</li>
 *   <li>Reject blank/null {@code schedule} + reject syntactically-invalid cron.</li>
 *   <li>For each job, call {@code esClient.indices().existsAlias(...)} and refuse to boot
 *       if the alias is absent (Pattern 5 / LOADER-03).</li>
 * </ol>
 *
 * <p>{@code @Profile("!test")} keeps {@code ContextLoadsTest} green without an Elasticsearch
 * client on the classpath (Pitfall L4). Plan 03 tests instantiate the service directly via
 * {@code ReflectionTestUtils} rather than booting a Spring context.
 */
@ConditionalOnProperty(name = "rectrace.loader.enabled", havingValue = "true", matchIfMissing = true)
@Profile("!test")
@Service
@Slf4j
public class LoaderConfigService {

    @Value("${loader-config.location}")
    private String configLocation;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ResourceLoader resourceLoader;

    @Autowired(required = false)
    private ElasticsearchClient esClient;

    private LoaderConfigV4 configuration;
    private Map<String, LoaderJobDefV4> jobMap = new HashMap<>();

    @PostConstruct
    public void load() {
        log.info("Loading loader configuration from: {}", configLocation);

        Resource resource = resourceLoader.getResource(configLocation);
        try (InputStream is = resource.getInputStream()) {
            configuration = objectMapper.readValue(is, LoaderConfigV4.class);
        } catch (IOException e) {
            throw new RuntimeException("Failed to load loader configuration from " + configLocation, e);
        }

        if (configuration == null || configuration.getJobs() == null || configuration.getJobs().isEmpty()) {
            log.warn("Loader configuration is empty — no loader jobs will run (configLocation={})", configLocation);
            configuration = new LoaderConfigV4();
            configuration.setJobs(Collections.emptyList());
            jobMap = Collections.emptyMap();
            return;
        }

        // Pass 1 — per-job structural validation (collect-then-throw per Phase 5 pattern).
        List<String> errors = new ArrayList<>();
        for (LoaderJobDefV4 def : configuration.getJobs()) {
            String label = def.getKey() == null ? "<missing-key>" : def.getKey();
            if (def.getKey() == null || def.getKey().isBlank()) {
                errors.add("loader job has blank key");
            }
            if (def.getSource() == null) {
                errors.add("loader job [" + label + "] has no source");
            } else {
                if (def.getSource().getQuery() == null || def.getSource().getQuery().isBlank()) {
                    errors.add("loader job [" + label + "] has blank source.query");
                }
                if (def.getSource().getPrimaryKey() == null || def.getSource().getPrimaryKey().isEmpty()) {
                    errors.add("loader job [" + label + "] has empty source.primaryKey");
                }
            }
            if (def.getTarget() == null || def.getTarget().getAlias() == null
                    || def.getTarget().getAlias().isBlank()) {
                errors.add("loader job [" + label + "] has blank target.alias");
            }
            if (def.getSchedule() == null || def.getSchedule().isBlank()) {
                errors.add("loader job [" + label + "] has blank schedule");
            } else {
                try {
                    CronExpression.parse(def.getSchedule());
                } catch (IllegalArgumentException e) {
                    errors.add("loader job [" + label + "] has invalid cron schedule ["
                            + def.getSchedule() + "]: " + e.getMessage());
                }
            }
        }
        if (!errors.isEmpty()) {
            throw new IllegalStateException("Invalid loader configuration: " + String.join("; ", errors));
        }

        // Pass 2 — duplicate-key detection.
        Map<String, LoaderJobDefV4> built = new LinkedHashMap<>();
        for (LoaderJobDefV4 def : configuration.getJobs()) {
            if (built.containsKey(def.getKey())) {
                throw new IllegalStateException("duplicate loader job key: " + def.getKey());
            }
            built.put(def.getKey(), def);
        }
        jobMap = built;

        // Pass 3 — boot-time ES alias existence check (LOADER-03 / Pattern 5).
        if (esClient == null) {
            log.warn("ElasticsearchClient not configured — skipping boot-time alias existence check "
                    + "(production deploys must configure spring.elasticsearch.uris)");
        } else {
            for (LoaderJobDefV4 def : configuration.getJobs()) {
                String alias = def.getTarget().getAlias();
                boolean exists;
                try {
                    exists = esClient.indices().existsAlias(b -> b.name(alias)).value();
                } catch (IOException e) {
                    throw new IllegalStateException("Failed to check existence of ES alias [" + alias
                            + "] for loader job [" + def.getKey() + "]", e);
                }
                if (!exists) {
                    throw new IllegalStateException("Loader job [" + def.getKey() + "] references alias ["
                            + alias + "] which does not exist in Elasticsearch. Refusing to boot.");
                }
            }
        }

        log.info("Successfully loaded {} loader job(s): {}", jobMap.size(), jobMap.keySet());
    }

    public LoaderConfigV4 getConfiguration() {
        return configuration;
    }

    public List<LoaderJobDefV4> getJobs() {
        return configuration == null || configuration.getJobs() == null
                ? Collections.emptyList()
                : configuration.getJobs();
    }

    public Optional<LoaderJobDefV4> getJob(String key) {
        return Optional.ofNullable(jobMap.get(key));
    }
}
