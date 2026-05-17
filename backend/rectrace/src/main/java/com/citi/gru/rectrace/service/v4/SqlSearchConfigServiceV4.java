package com.citi.gru.rectrace.service.v4;

import java.io.InputStream;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;

import com.citi.gru.rectrace.dto.v4.SqlSearchConfigV4;
import com.citi.gru.rectrace.dto.v4.SqlTabConfigV4;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

/**
 * Phase 5 / SQL-01 + SQL-02 + SQL-05 — loads {@code sql-search-config-v4.json} at
 * application startup and validates every configured tab's query via
 * {@link SqlShapeValidator}. Any violation throws {@link IllegalStateException} from the
 * {@code @PostConstruct}, which Spring re-throws as {@code BeanCreationException} and the
 * application refuses to boot (defense-in-depth at boot time; the request-time gate lands
 * in Plan 05).
 *
 * <p>The service is unconditionally active (no {@code @Profile("!test")}) because it has no
 * DB dependency. Tests inject bad/good fixtures via {@code sql-search-config.location}.
 *
 * <p>If the configured location does not exist on the classpath, the service logs a warning
 * and exposes an empty tabs list — boot is NOT failed because the absence of the JSON is a
 * legitimate dev/test setup (e.g. {@code ContextLoadsTest} runs without a SQL-tab config).
 * Boot is only failed when a JSON IS present and contains a shape violation.
 */
@Service
@Slf4j
public class SqlSearchConfigServiceV4 {

    @Value("${sql-search-config.location:classpath:sql-search-config-v4.json}")
    private String configLocation;

    private final ResourceLoader resourceLoader;
    private final ObjectMapper objectMapper;

    private SqlSearchConfigV4 config;

    public SqlSearchConfigServiceV4(ResourceLoader resourceLoader, ObjectMapper objectMapper) {
        this.resourceLoader = resourceLoader;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() {
        log.info("Loading SQL search configuration from: {}", configLocation);

        Resource resource = resourceLoader.getResource(configLocation);
        if (!resource.exists()) {
            log.warn(
                "SQL search config at [{}] does not exist — exposing empty tabs list. "
                    + "This is non-fatal; SQL-tab endpoints will return an empty config.",
                configLocation);
            config = new SqlSearchConfigV4();
            config.setTabs(Collections.emptyList());
            return;
        }

        SqlSearchConfigV4 loaded;
        try (InputStream is = resource.getInputStream()) {
            loaded = objectMapper.readValue(is, SqlSearchConfigV4.class);
        } catch (Exception e) {
            throw new IllegalStateException(
                "SQL search config at [" + configLocation + "] failed to parse: " + e.getMessage(), e);
        }

        if (loaded == null) {
            throw new IllegalStateException(
                "SQL search config at [" + configLocation + "] parsed to null");
        }
        if (loaded.getTabs() == null) {
            loaded.setTabs(Collections.emptyList());
        }

        List<SqlTabConfigV4> tabs = loaded.getTabs();

        // Duplicate-key detection — first-wins would mask later entries silently.
        long distinctKeys = tabs.stream().map(SqlTabConfigV4::getKey).distinct().count();
        if (distinctKeys != tabs.size()) {
            throw new IllegalStateException(
                "SQL search config at [" + configLocation + "] contains duplicate tab keys");
        }

        for (SqlTabConfigV4 tab : tabs) {
            if (isBlank(tab.getKey())) {
                throw new IllegalStateException(
                    "SQL search config at [" + configLocation + "] has a tab with blank key");
            }
            if (isBlank(tab.getLabel())) {
                throw new IllegalStateException(
                    "SQL tab [" + tab.getKey() + "] has blank label");
            }
            if (isBlank(tab.getQuery())) {
                throw new IllegalStateException(
                    "SQL tab [" + tab.getKey() + "] has blank query");
            }

            // Shape validation — throws IllegalStateException naming the offending tab
            // on non-SELECT or missing WHERE+FETCH. Propagate unmodified so the message
            // surface carries the offender's key.
            SqlShapeValidator.validate(tab.getKey(), tab.getQuery());

            int columnCount = tab.getColumns() == null ? 0 : tab.getColumns().size();
            log.info("Loaded SQL tab [{}]: {} columns", tab.getKey(), columnCount);
        }

        this.config = loaded;
    }

    public List<SqlTabConfigV4> getTabs() {
        return config.getTabs();
    }

    public Optional<SqlTabConfigV4> getTab(String key) {
        return config.getTabs().stream()
            .filter(t -> t.getKey().equals(key))
            .findFirst();
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
