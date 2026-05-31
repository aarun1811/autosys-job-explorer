package com.citi.gru.rectrace.loader.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Phase 6 / LOADER-01 — Oracle source side of a loader job.
 *
 * <p>{@code datasource} selects the connection pool (only {@code "primary"} is supported in
 * Phase 6 per D-6.16; the readonly pool is reserved for the Phase 5 SQL-tab evaluator).
 *
 * <p>{@code primaryKey} is the ordered list of column names whose values combine into the
 * deterministic ES document ID via {@code DocumentIdHasher}. Order is contract-significant —
 * reordering would re-key the entire index.
 *
 * <p>Plain POJO — no Lombok in this module (Task 3 convention).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LoaderSourceConfigV4 {
    private String datasource = "primary";
    private String query;
    private List<String> primaryKey;

    public LoaderSourceConfigV4() {
    }

    public String getDatasource() {
        return datasource;
    }

    public void setDatasource(String datasource) {
        this.datasource = datasource;
    }

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public List<String> getPrimaryKey() {
        return primaryKey;
    }

    public void setPrimaryKey(List<String> primaryKey) {
        this.primaryKey = primaryKey;
    }
}
