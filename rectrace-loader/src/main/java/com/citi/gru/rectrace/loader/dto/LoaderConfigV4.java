package com.citi.gru.rectrace.loader.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Phase 6 / LOADER-01 — root DTO for {@code loader-config-v4.json}.
 *
 * <p>Mirrors the shape of {@code SearchConfigurationV4} / {@code SqlSearchConfigV4}: a single
 * top-level list of loader jobs. Each entry is a {@link LoaderJobDefV4} carrying the Oracle
 * source query, the Elasticsearch target alias + batch tuning, and a Spring cron schedule.
 *
 * <p>Loaded once at boot by {@code LoaderConfigService} via {@code @PostConstruct}.
 *
 * <p>Plain POJO — no Lombok in this module (Task 3 convention; the rectrace-loader pom
 * deliberately excludes the Lombok dependency).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LoaderConfigV4 {
    private List<LoaderJobDefV4> jobs;

    public LoaderConfigV4() {
    }

    public List<LoaderJobDefV4> getJobs() {
        return jobs;
    }

    public void setJobs(List<LoaderJobDefV4> jobs) {
        this.jobs = jobs;
    }
}
