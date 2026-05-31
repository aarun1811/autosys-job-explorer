package com.citi.gru.rectrace.loader;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Component;

import com.citi.gru.rectrace.loader.dto.LoaderJobDefV4;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._helpers.bulk.BulkIngester;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

/**
 * Phase 6 / LOADER-05 + LOADER-09 + LOADER-10 — per-job {@code BulkIngester} lifecycle and
 * cron-expression cache for the loader subsystem.
 *
 * <h2>What this class holds</h2>
 * For each {@code LoaderJobDefV4} returned by {@link LoaderConfigService#getJobs()}:
 * <ul>
 *   <li>A {@link BulkIngester}{@code <String>} built with the job's batch config
 *       ({@code rows}, {@code bytes}, {@code flushMs}) and a {@link LoaderBulkListener}.
 *       Context type {@code String} = {@code "jobKey:docId"} so per-item failure logs are
 *       traceable to source rows (06-RESEARCH.md Pattern 3).</li>
 *   <li>A parsed {@link CronExpression} so {@link #dueAt(Instant)} is a cheap map lookup
 *       and pure-function evaluation per tick — never re-parsing the cron string.</li>
 *   <li>The {@link LoaderBulkListener} instance so {@code OracleToEsLoaderJob} can read
 *       {@code getFailedItemCount()} after flush.</li>
 *   <li>The last fire-time {@link Instant} so the next-fire calculation uses the right
 *       reference point.</li>
 * </ul>
 *
 * <h2>Graceful shutdown ({@link PreDestroy})</h2>
 * Per LOADER-09 + Pitfall L3, SIGTERM must flush in-flight bulk ops before exit. The
 * shutdown handler iterates every ingester, calls {@code flush()} then {@code close()}
 * inside try/catch so a single misbehaving ingester cannot abort the rest. Spring's
 * {@code spring.lifecycle.timeout-per-shutdown-phase=60s} (Plan 02) is the hard ceiling.
 *
 * <p>{@code @Profile("!test")} keeps the registry out of the test ApplicationContext —
 * tests instantiate it directly with mocks (Pitfall L4).
 */
@Component
@Profile("!test")
public class LoaderJobRegistry {

    private static final Logger log = LoggerFactory.getLogger(LoaderJobRegistry.class);

    private final LoaderConfigService loaderConfig;
    private final ElasticsearchClient esClient;

    private final Map<String, BulkIngester<String>> ingesters = new ConcurrentHashMap<>();
    private final Map<String, CronExpression> cronExpressions = new ConcurrentHashMap<>();
    private final Map<String, LoaderBulkListener> listeners = new ConcurrentHashMap<>();
    private final Map<String, Instant> lastFireTimes = new ConcurrentHashMap<>();

    public LoaderJobRegistry(LoaderConfigService loaderConfig, ElasticsearchClient esClient) {
        this.loaderConfig = loaderConfig;
        this.esClient = esClient;
    }

    /**
     * Boot-time wiring: build one {@code BulkIngester} + {@code CronExpression} per job.
     *
     * <p>Cron strings are already pre-validated by {@link LoaderConfigService} so a parse
     * failure here is a programmer error, not a config issue, and is propagated.
     */
    @PostConstruct
    public void init() {
        Instant now = Instant.now();
        for (LoaderJobDefV4 def : loaderConfig.getJobs()) {
            String key = def.getKey();
            CronExpression cron;
            try {
                cron = CronExpression.parse(def.getSchedule());
            } catch (IllegalArgumentException e) {
                throw new IllegalStateException(
                        "Loader job [" + key + "] cron schedule [" + def.getSchedule()
                                + "] failed to parse at registry init — LoaderConfigService should have caught this",
                        e);
            }

            LoaderBulkListener listener = new LoaderBulkListener(key);
            BulkIngester<String> ingester = BulkIngester.<String>of(b -> b
                    .client(esClient)
                    .maxOperations(def.getTarget().getBatch() != null
                            ? def.getTarget().getBatch().getRows() : 5000)
                    .maxSize(def.getTarget().getBatch() != null
                            ? def.getTarget().getBatch().getBytes() : 5L * 1024L * 1024L)
                    .flushInterval(def.getTarget().getBatch() != null
                            ? def.getTarget().getBatch().getFlushMs() : 5000L, TimeUnit.MILLISECONDS)
                    .maxConcurrentRequests(1)
                    .listener(listener));

            ingesters.put(key, ingester);
            cronExpressions.put(key, cron);
            listeners.put(key, listener);
            lastFireTimes.put(key, now);
        }
        log.info("LoaderJobRegistry initialized with {} job(s): {}",
                ingesters.size(), ingesters.keySet());
    }

    /**
     * Return the jobs whose next-fire time relative to their last-fire is at or before {@code now}.
     * Declaration order from {@link LoaderConfigService#getJobs()} is preserved.
     *
     * <p>This is a pure read — does NOT mutate {@code lastFireTimes}. The ticker calls
     * {@link #markFired(String, Instant)} only after acquiring the per-job lock so the
     * update is mutex-protected.
     */
    public List<LoaderJobDefV4> dueAt(Instant now) {
        List<LoaderJobDefV4> due = new ArrayList<>();
        for (LoaderJobDefV4 def : loaderConfig.getJobs()) {
            String key = def.getKey();
            CronExpression cron = cronExpressions.get(key);
            Instant last = lastFireTimes.get(key);
            if (cron == null || last == null) {
                continue;
            }
            Instant next = cron.next(last);
            if (next != null && !next.isAfter(now)) {
                due.add(def);
            }
        }
        return due;
    }

    public BulkIngester<String> ingesterFor(String jobKey) {
        return ingesters.get(jobKey);
    }

    public LoaderBulkListener listenerFor(String jobKey) {
        return listeners.get(jobKey);
    }

    /**
     * Record the wall-clock time a job's tick fired. Called by {@code LoaderTicker} INSIDE
     * the locked task body so this update is also lock-protected.
     */
    public void markFired(String jobKey, Instant when) {
        lastFireTimes.put(jobKey, when);
    }

    /** Test seam: number of registered jobs (read-only). */
    public int size() {
        return ingesters.size();
    }

    /**
     * LOADER-09 graceful shutdown: flush + close every {@link BulkIngester} so in-flight
     * bulk operations drain before the JVM exits. Each ingester's close is wrapped in
     * try/catch so a single failure cannot abort the rest (Pitfall L3).
     *
     * <p>{@code flush()} forces an immediate drain; {@code close()} waits for outstanding
     * requests to complete. Order matters — flush BEFORE close so close has a stable view.
     */
    @PreDestroy
    public void shutdown() {
        log.info("Loader shutting down — flushing {} ingester(s)", ingesters.size());
        for (Map.Entry<String, BulkIngester<String>> e : ingesters.entrySet()) {
            String key = e.getKey();
            BulkIngester<String> ingester = e.getValue();
            try {
                ingester.flush();
                ingester.close();
            } catch (Throwable t) {
                log.error("Loader [{}] flush/close failed during shutdown", key, t);
            }
        }
        log.info("Loader shutdown complete");
    }
}
