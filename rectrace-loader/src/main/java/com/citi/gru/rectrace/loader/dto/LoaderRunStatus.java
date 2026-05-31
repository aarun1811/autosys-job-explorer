package com.citi.gru.rectrace.loader.dto;

/**
 * Phase 6 / LOADER-06 — terminal status of a single loader run.
 *
 * <p>String values map 1:1 to the {@code status} column of the {@code loader_run_history}
 * Oracle table (DDL in {@code rectrace-local-dev/schema/01-rectrace.sql}). The column is
 * a {@code VARCHAR2(16) CHECK (status IN ('RUNNING','SUCCESS','FAILED'))} so any new
 * enum constant requires a DDL change first.
 */
public enum LoaderRunStatus {
    RUNNING,
    SUCCESS,
    FAILED
}
