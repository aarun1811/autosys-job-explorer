package com.citi.gru.rectrace.loader.dto;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Phase 6 / LOADER-06 — read-side DTO for a single row of {@code loader_run_history}.
 *
 * <p>Populated by {@code LoaderRunHistoryService.lastN(...)} and surfaced through the
 * Plan 05 admin endpoint. {@code finishedAt}, {@code rowCount}, {@code durationMs}, and
 * {@code lastError} are nullable while a run is in flight ({@code status = RUNNING}).
 *
 * <p>Plain POJO — no Lombok in this module (Task 3 convention).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LoaderRunRecordV4 {
    private String jobKey;
    private Instant startedAt;
    private Instant finishedAt;
    private LoaderRunStatus status;
    private Long rowCount;
    private String lastError;
    private Long durationMs;

    public LoaderRunRecordV4() {
    }

    public String getJobKey() {
        return jobKey;
    }

    public void setJobKey(String jobKey) {
        this.jobKey = jobKey;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public void setFinishedAt(Instant finishedAt) {
        this.finishedAt = finishedAt;
    }

    public LoaderRunStatus getStatus() {
        return status;
    }

    public void setStatus(LoaderRunStatus status) {
        this.status = status;
    }

    public Long getRowCount() {
        return rowCount;
    }

    public void setRowCount(Long rowCount) {
        this.rowCount = rowCount;
    }

    public String getLastError() {
        return lastError;
    }

    public void setLastError(String lastError) {
        this.lastError = lastError;
    }

    public Long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(Long durationMs) {
        this.durationMs = durationMs;
    }
}
