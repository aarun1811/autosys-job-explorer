package com.citi.gru.rectrace.loader;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.fail;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

/**
 * Phase 6 / LOADER-10 — Wave-0 contract scaffold for ES BulkIngester construction + tuning.
 *
 * <p>Wave-0 scaffold per Plan 06-02. All methods @Disabled until Plan 06-04 enables this class.
 *
 * <p>The target class (likely {@code BulkIngesterFactory} or a {@code @Bean} method on
 * {@code OracleToEsLoaderJob}) is introduced by Plan 06-04 and produces an Elasticsearch
 * {@code BulkIngester<Void>} (java-client) with batching parameters drawn from the per-job
 * config in {@code loader-config.json}.
 *
 * <p>Default batching (LOADER-10 contract per 06-RESEARCH.md):
 * <ul>
 *   <li>{@code maxOperations = 5000} — soft cap on per-batch row count.</li>
 *   <li>{@code maxSize = 5 MiB} — hard cap on per-batch byte size.</li>
 *   <li>{@code flushInterval = 5s} — time-based flush to bound staleness on idle jobs.</li>
 *   <li>{@code maxConcurrentRequests = 1} — serialize per loader (LOADER-02 already serializes
 *       at the job level; this prevents intra-batch interleaving).</li>
 * </ul>
 *
 * <p>BulkIngester does not expose getters for its config. Plan 06-04 must choose between:
 * (a) capturing the config in a {@code BulkIngesterSettings} record exposed for testing, or
 * (b) testing observable behavior — push N+1 ops and assert the listener fires N flushes.
 */
@Disabled("Wave 0 / Plan 06-02 — enabled when BulkIngester wiring lands in Plan 06-04")
class BulkIngesterFactoryTest {

    @Test
    void defaultBatchSettingsAre5000Rows5MB5Seconds() {
        // Plan 06-04 option (a): assertThat(settings.maxOperations()).isEqualTo(5000);
        //                        assertThat(settings.maxSize().toBytes()).isEqualTo(5L * 1024 * 1024);
        //                        assertThat(settings.flushInterval()).isEqualTo(Duration.ofSeconds(5));
        // Plan 06-04 option (b): push 5001 ops, observe exactly one flush from the listener.
        assertThat(0).as("LOADER-10: default BulkIngester settings must be 5000 ops / 5 MiB / 5s").isEqualTo(0);
        fail("LOADER-10: default settings assertion pending Plan 06-04 implementation choice");
    }

    @Test
    void perJobOverridesAreHonored() {
        // Plan 06-04: a LoaderJobDefV4 with batch.rows=100 must produce an ingester whose
        // effective maxOperations is 100. Concrete behavioral assertion (option b above):
        // push 100 ops, observe exactly one flush invocation on the BulkListener.
        fail("LOADER-10: per-job batch overrides from loader-config.json must propagate to BulkIngester");
    }
}
