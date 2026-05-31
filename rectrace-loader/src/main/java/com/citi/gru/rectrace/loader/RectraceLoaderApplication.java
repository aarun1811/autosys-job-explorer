package com.citi.gru.rectrace.loader;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Citi GRU Rectrace ES Loader Worker — Spring Boot 3.5.14, Java 21, port 6089.
 *
 * <p>Worker module extracted from {@code backend/rectrace} per the loader-extraction
 * design (docs/superpowers/specs/2026-05-31-loader-extraction-design.md). Owns the
 * ES Loader subsystem: ShedLock-coordinated {@code @Scheduled} ticker that drives
 * Oracle → Elasticsearch ingestion via {@code BulkIngester} + admin endpoints at
 * {@code /api/v4/loader-admin/*}. Backend (port 6088) is now a pure read-side API
 * with zero loader awareness.
 *
 * <p>This is the Phase 1 skeleton — the loader beans land in Phase 3.
 */
@SpringBootApplication
public class RectraceLoaderApplication {

    public static void main(String[] args) {
        SpringApplication.run(RectraceLoaderApplication.class, args);
    }
}
