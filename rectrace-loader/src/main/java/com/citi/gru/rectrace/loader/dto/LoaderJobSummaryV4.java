package com.citi.gru.rectrace.loader.dto;

import com.citi.gru.rectrace.loader.dto.LoaderRunRecordV4;
import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Phase 6 / LOADER-08 — compact view of a configured loader job for the admin {@code GET /jobs}
 * endpoint.
 *
 * <p>One entry per configured loader job. {@code lastRun} is nullable — null when no runs have
 * happened yet (e.g. immediately after first boot before the first scheduled tick).
 *
 * <p>{@code key}, {@code alias}, {@code schedule}, {@code timezone} mirror the configured
 * {@code LoaderJobDefV4} (key + target.alias + schedule + timezone) so the admin UI can render
 * the operator-facing schedule without re-reading the on-disk config.
 */
@Data
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LoaderJobSummaryV4 {
    private String key;
    private String alias;
    private String schedule;
    private String timezone;
    private LoaderRunRecordV4 lastRun;
}
