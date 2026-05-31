package com.citi.gru.rectrace.loader;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.citi.gru.rectrace.loader.dto.LoaderJobDefV4;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.core.LockConfiguration;
import net.javacrumbs.shedlock.core.LockingTaskExecutor;
import net.javacrumbs.shedlock.core.LockingTaskExecutor.TaskResult;
import net.javacrumbs.shedlock.core.LockingTaskExecutor.TaskWithResult;

/**
 * Phase 6 / LOADER-02 — the single ticker that fans out to per-job runs.
 *
 * <h2>Design — Pattern 2 (06-RESEARCH.md §6)</h2>
 * Spring's {@code @Scheduled(cron=...)} requires a compile-time-constant cron expression
 * per method. Our cron strings are config-driven, so we use the alternative pattern:
 * <ol>
 *   <li>One {@code @Scheduled(fixedDelayString="PT30S")} method ({@link #tick()}).</li>
 *   <li>Per tick, query {@link LoaderJobRegistry#dueAt(Instant)} for jobs whose cron has
 *       come due since their last fire.</li>
 *   <li>For each due job, call
 *       {@link LockingTaskExecutor#executeWithLock(TaskWithResult, LockConfiguration)} with
 *       lock name {@code "loader:<jobKey>"}. ShedLock guarantees one run per name across
 *       this VM (and across multiple VMs in a future HA-01 deployment).</li>
 * </ol>
 *
 * <h2>{@code lockAtMostFor} = 55 min, {@code lockAtLeastFor} = 5 s</h2>
 * The 55-minute ceiling is the crash-safety net (D-6.0, A10). The 5-second anti-thrash
 * floor (D-6.2) ensures that if a run finishes in 200 ms the lock is still held for a few
 * seconds after — preventing the next 30s tick from racing on a re-fire (e.g. cron =
 * {@code "*\/30 * * * * *"} firing again immediately on the tick boundary).
 *
 * <h2>{@code markFired} sequencing</h2>
 * The registry's {@code markFired} is invoked INSIDE the locked task so the
 * {@code lastFireTimes} update is also mutex-protected — two ticks for the same job_key
 * cannot both observe the stale timestamp and double-fire even if the cron is sub-30-second.
 *
 * <h2>{@link #runNow(LoaderJobDefV4)}</h2>
 * Manual trigger consumed by Plan 05's admin controller (D-6.14). Same locking pattern as
 * {@link #tick()} but does NOT invoke {@code markFired} — a manual trigger is independent
 * of the cron schedule and must not perturb the next scheduled fire calculation. Returns
 * the {@link TaskResult} so the controller can map {@code wasExecuted()=false} to HTTP 409
 * (CONFLICT).
 */
@Component
@Profile("!test")
@Slf4j
@RequiredArgsConstructor
public class LoaderTicker {

    /** Anti-thrash floor for sub-30-second cron schedules (D-6.2). */
    static final Duration LOCK_AT_LEAST_FOR = Duration.ofSeconds(5);

    /** Crash-safety ceiling — matches {@code @EnableSchedulerLock(defaultLockAtMostFor)}. */
    static final Duration LOCK_AT_MOST_FOR = Duration.ofMinutes(55);

    private final LoaderJobRegistry registry;
    private final OracleToEsLoaderJob job;
    private final LockingTaskExecutor lockingTaskExecutor;

    /**
     * Fires every 30 s and dispatches any job whose cron has come due. {@code fixedDelayString}
     * (not {@code fixedRate}) means the next tick starts 30 s after the PREVIOUS tick
     * returned — no thundering-herd if a tick takes longer than expected.
     */
    @Scheduled(fixedDelayString = "PT30S")
    public void tick() {
        Instant now = Instant.now();
        List<LoaderJobDefV4> due;
        try {
            due = registry.dueAt(now);
        } catch (Throwable t) {
            log.error("Loader ticker: dueAt() threw — skipping this tick", t);
            return;
        }
        if (due.isEmpty()) {
            return;
        }
        for (LoaderJobDefV4 def : due) {
            dispatchTick(def, now);
        }
    }

    private void dispatchTick(LoaderJobDefV4 def, Instant now) {
        String key = def.getKey();
        LockConfiguration cfg = new LockConfiguration(now, "loader:" + key,
                LOCK_AT_MOST_FOR, LOCK_AT_LEAST_FOR);
        try {
            TaskResult<Void> r = lockingTaskExecutor.executeWithLock(
                    (TaskWithResult<Void>) () -> {
                        registry.markFired(key, now);
                        job.run(def);
                        return null;
                    }, cfg);
            if (!r.wasExecuted()) {
                log.debug("Loader job {} skipped this tick — lock held by other run", key);
            }
        } catch (Throwable t) {
            log.error("Loader ticker: dispatch failed for {}", key, t);
        }
    }

    /**
     * Manual / admin-triggered run-now. Same locking semantics as {@link #tick()} but does
     * NOT update {@code lastFireTimes} — a manual trigger should not shift the next
     * scheduled fire. Returns the {@link TaskResult} so the admin controller can render
     * HTTP 200 vs 409 based on {@code wasExecuted()}.
     *
     * @return the executor's result; never null
     */
    public TaskResult<Void> runNow(LoaderJobDefV4 def) {
        String key = def.getKey();
        LockConfiguration cfg = new LockConfiguration(Instant.now(), "loader:" + key,
                LOCK_AT_MOST_FOR, LOCK_AT_LEAST_FOR);
        try {
            return lockingTaskExecutor.executeWithLock(
                    (TaskWithResult<Void>) () -> {
                        job.run(def);
                        return null;
                    }, cfg);
        } catch (Throwable t) {
            log.error("Loader runNow: dispatch failed for {}", key, t);
            // Caller treats this as 'not executed' — they get a TaskResult-shaped failure.
            // Build a notExecuted result via the public TaskResult API by re-throwing as
            // a runtime exception so the controller surfaces 500 distinctly from 409.
            throw new IllegalStateException("Loader runNow failed for " + key, t);
        }
    }
}
