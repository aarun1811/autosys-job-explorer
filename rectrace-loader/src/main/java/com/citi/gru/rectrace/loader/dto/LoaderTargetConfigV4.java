package com.citi.gru.rectrace.loader.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Phase 6 / LOADER-01 — Elasticsearch target side of a loader job.
 *
 * <p>{@code alias} must exist in the cluster at boot (Pattern 5 / LOADER-03 — boot-failure
 * on missing alias is enforced by {@code LoaderConfigService}). The alias is the upsert
 * target, never a concrete index, so backing indices can be rotated without code changes.
 */
@Data
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LoaderTargetConfigV4 {
    private String alias;
    private LoaderBatchConfigV4 batch;
}
