package com.citi.gru.rectrace.loader.dto;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Phase 6 / LOADER-06 — read-side DTO for a single row of {@code loader_run_history}.
 *
 * <p>Populated by {@code LoaderRunHistoryService.lastN(...)} and surfaced through the
 * Plan 05 admin endpoint. {@code finishedAt}, {@code rowCount}, {@code durationMs}, and
 * {@code lastError} are nullable while a run is in flight ({@code status = RUNNING}).
 */
@Data
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LoaderRunRecordV4 {
    private String jobKey;
    private Instant startedAt;
    private Instant finishedAt;
    private LoaderRunStatus status;
    private Long rowCount;
    private String lastError;
    private Long durationMs;
}
