package com.citi.gru.rectrace.loader.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.Data;
import lombok.NoArgsConstructor;

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
 */
@Data
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LoaderJobDefV4 {
    private String key;
    private LoaderSourceConfigV4 source;
    private LoaderTargetConfigV4 target;
    private String schedule;
    private String timezone = "UTC";
}
