package com.citi.gru.rectrace.loader;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.fail;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

/**
 * Phase 6 / LOADER-06 + LOADER-07 — Wave-0 contract scaffold for loader-run history persistence
 * and last-N retention pruning.
 *
 * <p>Wave-0 scaffold per Plan 06-02. All methods @Disabled until Plan 06-03 enables this class.
 *
 * <p>The target class {@code com.citi.gru.rectrace.loader.LoaderRunHistoryService} is introduced
 * by Plan 06-03 and persists one row per loader run to the {@code loader_run_history} Oracle
 * table (DDL shipped in Plan 06-01's {@code rectrace-local-dev/schema/01-rectrace.sql}).
 *
 * <p>LOADER-06 contract:
 * <ul>
 *   <li>{@code recordRunStart(jobKey)} inserts a row with {@code status='RUNNING'}, {@code finished_at IS NULL}.</li>
 *   <li>{@code recordRunSuccess(jobKey, startedAt, rowCount, durationMs)} flips the row to
 *       {@code status='SUCCESS'} and populates the metrics.</li>
 *   <li>{@code recordRunFailure(jobKey, startedAt, throwable)} captures the stack trace into
 *       {@code last_error}, truncated to 8192 chars (8 KB — per Research A8 to stay well under
 *       Oracle's CLOB indexing limits and avoid log-row bloat).</li>
 * </ul>
 *
 * <p>LOADER-07 contract: the prune operation retains exactly 20 rows per job_key and is
 * race-safe between concurrent prune calls scoped to different job keys.
 *
 * <p>Plan 06-03 enables this class once it ships either (a) an embedded H2 fixture mirroring
 * the loader_run_history DDL or (b) Testcontainers Oracle. The Wave-0 scaffold is documentation
 * of the contract — methods @Disabled until the fixture wiring lands.
 */
@Disabled("Wave 0 / Plan 06-02 — enabled when LoaderRunHistoryService + DB fixture land in Plan 06-03")
class LoaderRunHistoryServiceTest {

    @Test
    void recordRunStartInsertsRunningRow() {
        // Plan 06-03: svc.recordRunStart("jobA");
        // Query: SELECT status, finished_at FROM loader_run_history WHERE job_key='jobA' ORDER BY started_at DESC FETCH FIRST 1 ROWS ONLY;
        // assertThat(status).isEqualTo("RUNNING"); assertThat(finishedAt).isNull();
        fail("LOADER-06: recordRunStart must insert a row with status=RUNNING and finished_at=NULL");
    }

    @Test
    void recordRunSuccessUpdatesRowToSuccess() {
        // Plan 06-03: svc.recordRunStart("jobA"); svc.recordRunSuccess("jobA", startedAt, 42, 12345);
        // Contract: row updated to status='SUCCESS', row_count=42, duration_ms=12345, finished_at IS NOT NULL.
        fail("LOADER-06: recordRunSuccess must update row to SUCCESS with row_count, duration_ms, finished_at populated");
    }

    @Test
    void recordRunFailureCapturesTruncatedError() {
        // Plan 06-03 / Research A8: simulate an 80 KB stack-trace string, pass to recordRunFailure.
        // Query: SELECT last_error FROM loader_run_history WHERE job_key='jobA';
        // assertThat(lastError).hasSize(8192); // exactly 8 KB truncation
        assertThat("").as("LOADER-06: last_error must be truncated to exactly 8192 chars").hasSize(8192);
    }

    @Test
    void pruneToLast20RetainsExactly20RowsPerJob() {
        // Plan 06-03 / LOADER-07: insert 25 rows for "jobA"; svc.pruneToLast20("jobA");
        // assertThat(rowCount("jobA")).isEqualTo(20);
        // The oldest 5 by started_at must be gone.
        fail("LOADER-07: pruneToLast20 must retain exactly 20 most-recent rows per job_key");
    }

    @Test
    void pruneIsScopedToOneJobKey() {
        // Plan 06-03 / LOADER-07 race-safety: insert 25 rows for jobA + 25 rows for jobB.
        // svc.pruneToLast20("jobA");
        // assertThat(rowCount("jobA")).isEqualTo(20);
        // assertThat(rowCount("jobB")).isEqualTo(25); // untouched
        fail("LOADER-07: prune must be scoped to a single job_key (no cross-job side-effects)");
    }
}
