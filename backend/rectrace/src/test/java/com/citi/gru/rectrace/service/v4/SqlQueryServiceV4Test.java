package com.citi.gru.rectrace.service.v4;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.util.Collections;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementCallback;
import org.springframework.jdbc.core.PreparedStatementCreator;

/**
 * Phase 5 / SQL-04 + SQL-05 (executor-side defense in depth): locks the SqlQueryServiceV4
 * contract — per-statement resource caps applied to the PreparedStatement (never the
 * singleton JdbcTemplate), and the executed SQL is always wrapped with the
 * {@code OFFSET ? ROWS FETCH NEXT ? ROWS ONLY} pagination clause.
 *
 * <p>Wave 0 scaffolding — both tests {@code @Disabled} with the literal {@code "Wave 4: ..."}
 * reason string.
 *
 * <p>TODO Wave 4: instantiate the real {@code SqlQueryServiceV4} (a no-op placeholder type
 * for now lives only inside this test class as comments) by passing the mocked
 * {@link JdbcTemplate} as the {@code readonlyJdbcTemplate} dependency, then invoke the
 * paged-query method that wraps the configured SELECT with OFFSET/FETCH and applies
 * per-statement caps via a {@link PreparedStatementCreator} +
 * {@link PreparedStatementCallback}.
 */
class SqlQueryServiceV4Test {

    // TODO Wave 4: replace this placeholder with the real production class. For now the test
    // captures the contract; the inline stub call below documents what Wave 4 must wire.
    //
    //   class SqlQueryServiceV4 {
    //       SqlQueryServiceV4(JdbcTemplate readonlyJdbcTemplate, SqlSearchConfigServiceV4 cfg) { ... }
    //       List<Map<String,Object>> fetchPage(String tabKey, int startRow, int endRow, ...) { ... }
    //   }

    @Disabled("Wave 4: enabled when SqlQueryServiceV4 lands")
    @Test
    void perStatementCapsAppliedNotSingleton() throws Exception {
        JdbcTemplate jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        Connection conn = Mockito.mock(Connection.class);
        PreparedStatement ps = Mockito.mock(PreparedStatement.class);
        when(conn.prepareStatement(any(String.class))).thenReturn(ps);

        // Capture the PreparedStatementCreator lambda the service hands to JdbcTemplate.
        ArgumentCaptor<PreparedStatementCreator> creatorCaptor =
            ArgumentCaptor.forClass(PreparedStatementCreator.class);
        when(jdbcTemplate.execute(
                creatorCaptor.capture(),
                any(PreparedStatementCallback.class)))
            .thenReturn(Collections.emptyList());

        // TODO Wave 4: invoke the real service.fetchPage(...) with caps {30s / 500 / 10000}
        //              and a wrapped SQL containing OFFSET/FETCH NEXT.
        //   new SqlQueryServiceV4(jdbcTemplate, configService).fetchPage("reconSummary", 0, 100, ...);

        // Drive the captured lambda so we can verify the per-statement setters were called.
        PreparedStatementCreator creator = creatorCaptor.getValue();
        creator.createPreparedStatement(conn);

        // Per-statement caps applied to the PreparedStatement.
        verify(ps).setQueryTimeout(30);
        verify(ps).setFetchSize(500);
        verify(ps).setMaxRows(10_000);

        // Singleton JdbcTemplate is NEVER mutated — Pattern 2 / Pitfall 3 + 4.
        verify(jdbcTemplate, never()).setQueryTimeout(anyInt());
        verify(jdbcTemplate, never()).setFetchSize(anyInt());
        verify(jdbcTemplate, never()).setMaxRows(anyInt());
    }

    @Disabled("Wave 4: enabled when SqlQueryServiceV4 lands")
    @Test
    void injectsOffsetFetchWrapper() throws Exception {
        JdbcTemplate jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        Connection conn = Mockito.mock(Connection.class);
        PreparedStatement ps = Mockito.mock(PreparedStatement.class);
        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        when(conn.prepareStatement(sqlCaptor.capture())).thenReturn(ps);

        ArgumentCaptor<PreparedStatementCreator> creatorCaptor =
            ArgumentCaptor.forClass(PreparedStatementCreator.class);
        when(jdbcTemplate.execute(
                creatorCaptor.capture(),
                any(PreparedStatementCallback.class)))
            .thenReturn(Collections.emptyList());

        // TODO Wave 4: invoke service.fetchPage("reconSummary", 0, 100, ...);
        creatorCaptor.getValue().createPreparedStatement(conn);

        String executedSql = sqlCaptor.getValue();
        // Always-injected paging wrapper — SQL-05 defense in depth.
        org.junit.jupiter.api.Assertions.assertTrue(
            executedSql.matches("(?is)^\\s*SELECT \\* FROM \\(.*\\) .* OFFSET \\? ROWS FETCH NEXT \\? ROWS ONLY\\s*$"),
            () -> "executed SQL must wrap configured query with OFFSET ? ROWS FETCH NEXT ? ROWS ONLY; got: " + executedSql);
    }
}
