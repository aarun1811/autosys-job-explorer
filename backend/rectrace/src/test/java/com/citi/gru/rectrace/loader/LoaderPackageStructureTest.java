package com.citi.gru.rectrace.loader;

import static org.assertj.core.api.Assertions.assertThatCode;

import org.junit.jupiter.api.Test;

/**
 * Phase 6 / LOADER-05 — class-presence gate for the loader subsystem.
 *
 * <p>Plan 06-03 enables the three Plan-03 deliverable classes
 * ({@code LoaderConfigService}, {@code LoaderRunHistoryService}, {@code DocumentIdHasher}).
 * Plan 06-04 will enable the remaining three ({@code LoaderJobRegistry},
 * {@code OracleToEsLoaderJob}, {@code LoaderTicker}).
 */
class LoaderPackageStructureTest {

    @Test
    void loaderConfigServiceExists() {
        // Plan 06-03 deliverable.
        assertThatCode(() -> Class.forName("com.citi.gru.rectrace.loader.LoaderConfigService"))
            .as("LOADER-05: LoaderConfigService must exist in com.citi.gru.rectrace.loader")
            .doesNotThrowAnyException();
    }

    @Test
    void loaderJobRegistryExists() {
        // Plan 06-04 deliverable.
        assertThatCode(() -> Class.forName("com.citi.gru.rectrace.loader.LoaderJobRegistry"))
            .as("LOADER-05: LoaderJobRegistry must exist in com.citi.gru.rectrace.loader")
            .doesNotThrowAnyException();
    }

    @Test
    void oracleToEsLoaderJobExists() {
        // Plan 06-04 deliverable.
        assertThatCode(() -> Class.forName("com.citi.gru.rectrace.loader.OracleToEsLoaderJob"))
            .as("LOADER-05: OracleToEsLoaderJob must exist in com.citi.gru.rectrace.loader")
            .doesNotThrowAnyException();
    }

    @Test
    void loaderRunHistoryServiceExists() {
        // Plan 06-03 deliverable.
        assertThatCode(() -> Class.forName("com.citi.gru.rectrace.loader.LoaderRunHistoryService"))
            .as("LOADER-05: LoaderRunHistoryService must exist in com.citi.gru.rectrace.loader")
            .doesNotThrowAnyException();
    }

    @Test
    void documentIdHasherExists() {
        // Plan 06-03 deliverable.
        assertThatCode(() -> Class.forName("com.citi.gru.rectrace.loader.DocumentIdHasher"))
            .as("LOADER-05: DocumentIdHasher must exist in com.citi.gru.rectrace.loader")
            .doesNotThrowAnyException();
    }

    @Test
    void loaderTickerExists() {
        // Plan 06-04 deliverable.
        assertThatCode(() -> Class.forName("com.citi.gru.rectrace.loader.LoaderTicker"))
            .as("LOADER-05: LoaderTicker must exist in com.citi.gru.rectrace.loader")
            .doesNotThrowAnyException();
    }
}
