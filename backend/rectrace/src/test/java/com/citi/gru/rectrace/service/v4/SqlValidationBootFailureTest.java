package com.citi.gru.rectrace.service.v4;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Phase 5 / SQL-02 + SQL-05 (defense-in-depth): asserts the Spring application context
 * fails to start when {@code sql-search-config-v4.json} contains a malformed query.
 *
 * <p>Wave 0 scaffolding — all tests {@code @Disabled} with the literal {@code "Wave 4: ..."}
 * reason string.
 *
 * <p>TODO Wave 4: split into {@code @Nested} per fixture (or per-test {@code @SpringBootTest}
 * classes) with {@code @TestPropertySource(properties = "sql-search-config.location=classpath:test-sql-config-bad-insert.json")}
 * etc. Each fixture exercises one rejection reason; the test asserts
 * {@code IllegalStateException} bubbles out of the failed bean creation with a message
 * containing the offending tab key.
 */
@SpringBootTest
@ActiveProfiles("test")
class SqlValidationBootFailureTest {

    @Disabled("Wave 4: enabled when SqlSearchConfigServiceV4 lands")
    @Test
    void rejectsInsertStatement() {
        // Wave 4: @TestPropertySource pointing at test-sql-config-bad-insert.json
        // (a fixture whose single tab's query is "INSERT INTO foo VALUES (1)"). Assert
        // the SpringBoot context init fails with IllegalStateException whose cause-chain
        // message contains the offending tab key + "not a SELECT".
    }

    @Disabled("Wave 4: enabled when SqlSearchConfigServiceV4 lands")
    @Test
    void rejectsUnboundedSelect() {
        // Wave 4: @TestPropertySource pointing at test-sql-config-bad-unbounded.json
        // (a tab whose query is "SELECT * FROM rectrace_core" — no WHERE, no FETCH).
        // Assert IllegalStateException with message containing "missing both WHERE and FETCH".
    }

    @Disabled("Wave 4: enabled when SqlSearchConfigServiceV4 lands")
    @Test
    void acceptsValidCte() {
        // Wave 4: @TestPropertySource pointing at test-sql-config-good-cte.json
        // (a tab whose query is "WITH cte AS (SELECT 1 FROM dual WHERE 1=1) SELECT * FROM cte WHERE 1=1").
        // Assert context loads cleanly — no exception, getTabs() exposes the CTE tab.
    }
}
