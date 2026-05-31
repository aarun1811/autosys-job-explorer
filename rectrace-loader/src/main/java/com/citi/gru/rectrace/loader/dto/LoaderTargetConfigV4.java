package com.citi.gru.rectrace.loader.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Phase 6 / LOADER-01 — Elasticsearch target side of a loader job.
 *
 * <p>{@code alias} must exist in the cluster at boot (Pattern 5 / LOADER-03 — boot-failure
 * on missing alias is enforced by {@code LoaderConfigService}). The alias is the upsert
 * target, never a concrete index, so backing indices can be rotated without code changes.
 *
 * <p>Plain POJO — no Lombok in this module (Task 3 convention).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LoaderTargetConfigV4 {
    private String alias;
    private LoaderBatchConfigV4 batch;

    public LoaderTargetConfigV4() {
    }

    public String getAlias() {
        return alias;
    }

    public void setAlias(String alias) {
        this.alias = alias;
    }

    public LoaderBatchConfigV4 getBatch() {
        return batch;
    }

    public void setBatch(LoaderBatchConfigV4 batch) {
        this.batch = batch;
    }
}
