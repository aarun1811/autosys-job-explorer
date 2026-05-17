package com.citi.gru.rectrace.loader;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.citi.gru.rectrace.loader.dto.LoaderBatchConfigV4;
import com.citi.gru.rectrace.loader.dto.LoaderJobDefV4;
import com.citi.gru.rectrace.loader.dto.LoaderTargetConfigV4;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._helpers.bulk.BulkIngester;

/**
 * Phase 6 / LOADER-10 — verifies that {@code LoaderJobRegistry.init()} builds a per-job
 * {@link BulkIngester} with the configured batch knobs (rows / bytes / flush-ms).
 *
 * <p>The Elasticsearch Java API 8.x exposes accessors on {@code BulkIngester}
 * ({@code maxOperations()}, {@code maxSize()}, {@code flushInterval()}, {@code maxConcurrentRequests()})
 * so this test reads those directly — option (a) in the Wave-0 scaffold notes.
 *
 * <p>The {@code ElasticsearchClient} is mocked (the ingester only stores the reference at
 * build time; nothing is dispatched in this test because no operations are added). The
 * registry is instantiated directly to avoid booting a Spring context (Pitfall L4 — the
 * production registry is {@code @Profile("!test")}-gated).
 */
class BulkIngesterFactoryTest {

    private LoaderJobRegistry registry;

    @AfterEach
    void tearDown() {
        if (registry != null) {
            // Close any built ingesters so the test does not leak schedulers.
            registry.shutdown();
        }
    }

    @Test
    void defaultBatchSettingsAre5000Rows5MB5Seconds() {
        LoaderJobDefV4 def = jobDef("test-key", 5000, 5L * 1024L * 1024L, 5000L);
        registry = buildRegistry(List.of(def));

        BulkIngester<String> ingester = registry.ingesterFor("test-key");
        assertThat(ingester)
                .as("LOADER-10: registry.init() must build a BulkIngester for each configured job")
                .isNotNull();

        assertThat(ingester.maxOperations())
                .as("LOADER-10: default maxOperations is 5000 rows")
                .isEqualTo(5000);
        assertThat(ingester.maxSize())
                .as("LOADER-10: default maxSize is 5 MiB")
                .isEqualTo(5L * 1024L * 1024L);
        assertThat(ingester.flushInterval())
                .as("LOADER-10: default flushInterval is 5 seconds")
                .isEqualTo(Duration.ofMillis(5000L));
        assertThat(ingester.maxConcurrentRequests())
                .as("LOADER-10: maxConcurrentRequests is pinned at 1 to serialize intra-job flushes")
                .isEqualTo(1);
    }

    @Test
    void perJobOverridesAreHonored() {
        LoaderJobDefV4 jobA = jobDef("jobA", 100, 1L * 1024L * 1024L, 1000L);
        LoaderJobDefV4 jobB = jobDef("jobB", 10_000, 10L * 1024L * 1024L, 10_000L);
        registry = buildRegistry(List.of(jobA, jobB));

        BulkIngester<String> ingesterA = registry.ingesterFor("jobA");
        BulkIngester<String> ingesterB = registry.ingesterFor("jobB");

        assertThat(ingesterA).as("jobA ingester must exist").isNotNull();
        assertThat(ingesterB).as("jobB ingester must exist").isNotNull();

        assertThat(ingesterA.maxOperations()).as("jobA override: 100 rows").isEqualTo(100);
        assertThat(ingesterA.maxSize()).as("jobA override: 1 MiB").isEqualTo(1L * 1024L * 1024L);
        assertThat(ingesterA.flushInterval()).as("jobA override: 1s").isEqualTo(Duration.ofMillis(1000L));

        assertThat(ingesterB.maxOperations()).as("jobB override: 10 000 rows").isEqualTo(10_000);
        assertThat(ingesterB.maxSize()).as("jobB override: 10 MiB").isEqualTo(10L * 1024L * 1024L);
        assertThat(ingesterB.flushInterval()).as("jobB override: 10s").isEqualTo(Duration.ofMillis(10_000L));

        assertThat(registry.listenerFor("jobA")).as("per-job listener must be wired").isNotNull();
        assertThat(registry.listenerFor("jobB")).as("per-job listener must be wired").isNotNull();
        assertThat(registry.listenerFor("jobA"))
                .as("listener instances must NOT be shared across jobs")
                .isNotSameAs(registry.listenerFor("jobB"));
    }

    // --- helpers ---

    private static LoaderJobDefV4 jobDef(String key, int rows, long bytes, long flushMs) {
        LoaderBatchConfigV4 batch = new LoaderBatchConfigV4();
        batch.setRows(rows);
        batch.setBytes(bytes);
        batch.setFlushMs(flushMs);

        LoaderTargetConfigV4 target = new LoaderTargetConfigV4();
        target.setAlias(key + "-alias");
        target.setBatch(batch);

        LoaderJobDefV4 def = new LoaderJobDefV4();
        def.setKey(key);
        def.setTarget(target);
        def.setSchedule("0 0 * * * *"); // every hour — never fires in the test
        return def;
    }

    private static LoaderJobRegistry buildRegistry(List<LoaderJobDefV4> jobs) {
        LoaderConfigService cfg = mock(LoaderConfigService.class);
        when(cfg.getJobs()).thenReturn(jobs);
        // BulkIngester.of(...) reads esClient._transport().options() at build time, so a
        // plain mock NPEs. RETURNS_DEEP_STUBS lets Mockito synthesize the chain. The
        // ingester never actually dispatches in this test because no ops are added.
        ElasticsearchClient esClient = mock(ElasticsearchClient.class, RETURNS_DEEP_STUBS);

        LoaderJobRegistry r = new LoaderJobRegistry(cfg, esClient);
        ReflectionTestUtils.invokeMethod(r, "init");
        return r;
    }
}
