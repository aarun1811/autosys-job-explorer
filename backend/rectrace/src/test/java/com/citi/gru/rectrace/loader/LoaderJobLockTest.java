package com.citi.gru.rectrace.loader;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import net.javacrumbs.shedlock.core.DefaultLockingTaskExecutor;
import net.javacrumbs.shedlock.core.LockConfiguration;
import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.core.LockingTaskExecutor;
import net.javacrumbs.shedlock.core.LockingTaskExecutor.TaskResult;
import net.javacrumbs.shedlock.provider.inmemory.InMemoryLockProvider;

/**
 * Phase 6 / LOADER-02 — verifies that {@link LockingTaskExecutor#executeWithLock} provides
 * mutual exclusion within a single JVM.
 *
 * <p>This test uses the in-memory {@link InMemoryLockProvider} so it never touches Oracle —
 * the production {@code JdbcTemplateLockProvider} bean is {@code @Profile("!test")}-gated
 * and Plan 06 explicitly defers live-Oracle smoke verification to the smoke scripts.
 * The contract being asserted here is ShedLock's own (we trust the library) plus the wrapper
 * call shape that {@code LoaderTicker} uses (we own this).
 */
class LoaderJobLockTest {

    private LockingTaskExecutor executor;

    @BeforeEach
    void setUp() {
        LockProvider provider = new InMemoryLockProvider();
        executor = new DefaultLockingTaskExecutor(provider);
    }

    @Test
    void lockingTaskExecutorAcquiresLock() throws Throwable {
        LockConfiguration cfg = new LockConfiguration(
                Instant.now(),
                "loader:test",
                Duration.ofMinutes(55),
                Duration.ZERO);

        TaskResult<String> result = executor.executeWithLock(
                (LockingTaskExecutor.TaskWithResult<String>) () -> "ran",
                cfg);

        assertThat(result.wasExecuted())
                .as("LOADER-02: first executeWithLock with a fresh lock name must succeed")
                .isTrue();
        assertThat(result.getResult())
                .as("the task body must have produced its return value")
                .isEqualTo("ran");
    }

    @Test
    void secondAcquisitionWithSameNameReturnsNotExecuted() throws Throwable {
        // First acquisition holds the lock for 5 s (lockAtLeastFor), so an immediate
        // re-acquire must report not-executed.
        LockConfiguration first = new LockConfiguration(
                Instant.now(),
                "loader:dup-test",
                Duration.ofMinutes(55),
                Duration.ofSeconds(5));

        TaskResult<String> r1 = executor.executeWithLock(
                (LockingTaskExecutor.TaskWithResult<String>) () -> "first",
                first);

        assertThat(r1.wasExecuted())
                .as("first acquisition must succeed")
                .isTrue();

        // Same name, same lockAtLeastFor — InMemoryLockProvider deterministically honors it.
        LockConfiguration second = new LockConfiguration(
                Instant.now(),
                "loader:dup-test",
                Duration.ofMinutes(55),
                Duration.ofSeconds(5));

        TaskResult<String> r2 = executor.executeWithLock(
                (LockingTaskExecutor.TaskWithResult<String>) () -> "second",
                second);

        assertThat(r2.wasExecuted())
                .as("LOADER-02: re-entrant acquisition within lockAtLeastFor must return not-executed")
                .isFalse();
    }
}
