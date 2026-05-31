package com.citi.gru.rectrace.loader.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Phase 6 / LOADER-01 — single loader-job entry in {@code loader-config-v4.json}.
 *
 * <p>Each job stitches an Oracle source query to an Elasticsearch target alias on a Spring cron
 * schedule. {@code key} must be unique across the config (boot-failure on duplicates) and
 * {@code schedule} is parsed by {@code org.springframework.scheduling.support.CronExpression}.
 *
 * <p>{@code timezone} defaults to {@code "UTC"} to address Pitfall L9 — without an explicit
 * zone, Spring's cron evaluates against the JVM default which differs between dev macOS and
 * Citi VM Linux hosts.
 *
 * <p>Plain POJO — no Lombok in this module (Task 3 convention).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LoaderJobDefV4 {
    private String key;
    private LoaderSourceConfigV4 source;
    private LoaderTargetConfigV4 target;
    private String schedule;
    private String timezone = "UTC";

    public LoaderJobDefV4() {
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public LoaderSourceConfigV4 getSource() {
        return source;
    }

    public void setSource(LoaderSourceConfigV4 source) {
        this.source = source;
    }

    public LoaderTargetConfigV4 getTarget() {
        return target;
    }

    public void setTarget(LoaderTargetConfigV4 target) {
        this.target = target;
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
}
