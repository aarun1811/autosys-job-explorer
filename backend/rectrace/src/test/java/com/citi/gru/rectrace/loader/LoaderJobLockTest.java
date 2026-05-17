package com.citi.gru.rectrace.loader;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.fail;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

/**
 * Phase 6 / LOADER-02 — Wave-0 contract scaffold for ShedLock-backed loader job mutex.
 *
 * <p>Wave-0 scaffold per Plan 06-02. All methods @Disabled until Plan 06-04 enables this class.
 *
 * <p>The target wiring ({@code LoaderShedLockConfig}, {@code @SchedulerLock} on each loader job
 * method) is introduced by Plan 06-04. The {@code LockProvider} bean lives in a
 * {@code @Profile("!test")}-gated config, mirroring the dual-datasource pattern used by
 * {@code DataSourceConfig}/{@code AutosysDataSourceConfig}/{@code ReadonlyDataSourceConfig}.
 *
 * <p>When Plan 06-04 enables this test, it must additionally provide a {@code @TestConfiguration}
 * exposing an in-memory {@code LockProvider} (e.g. {@code DefaultLockManager} backed by an
 * {@code InMemoryStorageAccessor}) — the production JDBC-template provider is profile-excluded
 * during tests. Without that wiring, ShedLock's spring-aspect autowire would fail context init,
 * so the Wave-0 scaffold is correctly @Disabled until Plan 06-04 lands the @TestConfiguration.
 *
 * <p>Contract: a {@code LockingTaskExecutor} bean is available; calling {@code executeWithLock}
 * with the same {@code LockConfiguration} name twice (within {@code lockAtLeastFor}) results in
 * the second call returning {@code wasExecuted() == false} (LOADER-02 mutual exclusion).
 */
@Disabled("Wave 0 / Plan 06-02 — enabled when LoaderShedLockConfig + @SchedulerLock land in Plan 06-04")
class LoaderJobLockTest {

    @Test
    void lockingTaskExecutorAcquiresLock() {
        // Plan 06-04: inject LockingTaskExecutor, build LockConfiguration("loader:test", 30s, 1s),
        // call executeWithLock(Runnable, LockConfiguration), assertThat(result.wasExecuted()).isTrue();
        fail("LOADER-02: first executeWithLock call with a fresh lock name must succeed");
    }

    @Test
    void secondAcquisitionWithSameNameReturnsNotExecuted() {
        // Plan 06-04: invoke executeWithLock twice sequentially with the same lock name,
        // second call is within lockAtLeastFor of the first. Contract: second returns
        // wasExecuted() == false. This is the core LOADER-02 mutual-exclusion contract
        // (one VM process, two concurrent threads — never two concurrent loader runs).
        assertThat(false).as("LOADER-02: re-entrant lock acquisition must report not-executed").isTrue();
    }
}
