package com.citi.gru.rectrace.loader;

import static org.assertj.core.api.Assertions.assertThatCode;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

/**
 * Phase 6 / LOADER-05 — Wave-0 contract scaffold for loader-subsystem class presence.
 *
 * <p>Wave-0 scaffold per Plan 06-02. All methods @Disabled until Plans 06-03 (4 classes) and
 * 06-04 (2 classes) enable this class progressively.
 *
 * <p>This is the cheapest possible LOADER-05 gate: pure {@code Class.forName} reflective
 * presence checks, no Spring, no instantiation. Plan 06-03 may enable the first four methods
 * (its 4 deliverable classes) and Plan 06-04 enables the remaining two — or both plans flip
 * the class-level {@code @Disabled} off only after all six classes exist. Either approach
 * leaves the contract pinned at compile time.
 *
 * <p>LOADER-05 deliverable: the {@code com.citi.gru.rectrace.loader} package exists and
 * contains the six named classes that together implement the ES loader subsystem.
 */
@Disabled("Wave 0 / Plan 06-02 — enabled when all six loader classes land (Plans 06-03, 06-04)")
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
