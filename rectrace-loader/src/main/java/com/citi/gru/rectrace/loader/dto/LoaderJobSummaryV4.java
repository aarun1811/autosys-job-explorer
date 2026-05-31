package com.citi.gru.rectrace.loader.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

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
 *
 * <p>Plain POJO — no Lombok in this module (Task 3 convention).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LoaderJobSummaryV4 {
    private String key;
    private String alias;
    private String schedule;
    private String timezone;
    private LoaderRunRecordV4 lastRun;

    public LoaderJobSummaryV4() {
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public String getAlias() {
        return alias;
    }

    public void setAlias(String alias) {
        this.alias = alias;
    }

    public String getSchedule() {
        return schedule;
    }

    public void setSchedule(String schedule) {
        this.schedule = schedule;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public LoaderRunRecordV4 getLastRun() {
        return lastRun;
    }

    public void setLastRun(LoaderRunRecordV4 lastRun) {
        this.lastRun = lastRun;
    }
}
