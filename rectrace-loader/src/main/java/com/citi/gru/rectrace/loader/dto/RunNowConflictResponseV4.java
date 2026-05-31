package com.citi.gru.rectrace.loader.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Phase 6 / LOADER-08 / D-6.14 — body for the {@code POST /jobs/{key}/run-now} 409 Conflict
 * response.
 *
 * <p>Emitted by {@code LoaderAdminControllerV4} when ShedLock reports
 * {@code TaskResult.wasExecuted() == false} (a scheduled run is already in flight for the same
 * {@code job_key}). The shape is single-purpose so the React frontend (Phase 4+) can
 * deserialize the conflict path without dynamic JSON.
 *
 * <ul>
 *   <li>{@code reason} — constant string {@code "scheduled run in flight"} matches D-6.14.</li>
 *   <li>{@code currentRun} — the in-flight {@code RUNNING} record (nullable if the history
 *       table has no such row — possible only in a tight race window between the scheduled
 *       run inserting the row and ShedLock acquiring the lock).</li>
 * </ul>
 *
 * <p>Plain POJO — no Lombok in this module (Task 3 convention).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RunNowConflictResponseV4 {
    private String reason = "scheduled run in flight";
    private LoaderRunRecordV4 currentRun;

    public RunNowConflictResponseV4() {
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public LoaderRunRecordV4 getCurrentRun() {
        return currentRun;
    }

    public void setCurrentRun(LoaderRunRecordV4 currentRun) {
        this.currentRun = currentRun;
    }
}
