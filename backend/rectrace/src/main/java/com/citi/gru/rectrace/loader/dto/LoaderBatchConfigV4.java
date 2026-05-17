package com.citi.gru.rectrace.loader.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Phase 6 / LOADER-10 — BulkIngester batch-tuning knobs.
 *
 * <p>Defaults track the LOADER-10 baseline (5 000 rows, 5 MiB, 5 s flush) and can be
 * overridden per-job in {@code loader-config-v4.json}. Plan 04 wires these into the
 * Elasticsearch Java API's {@code BulkIngester.Builder}.
 */
@Data
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LoaderBatchConfigV4 {
    private int rows = 5000;
    private long bytes = 5L * 1024L * 1024L;
    private long flushMs = 5000L;
}
