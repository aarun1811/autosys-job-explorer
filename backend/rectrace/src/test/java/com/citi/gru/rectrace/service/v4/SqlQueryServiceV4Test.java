package com.citi.gru.rectrace.service.v4;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementCallback;
import org.springframework.jdbc.core.PreparedStatementCreator;

import com.citi.gru.rectrace.dto.v4.ColumnDefinition;
import com.citi.gru.rectrace.dto.v4.SSRMRequestV4;
import com.citi.gru.rectrace.dto.v4.SqlTabConfigV4;

/**
 * Phase 5 / SQL-04 + SQL-05 (executor-side defense in depth): locks the SqlQueryServiceV4
 * contract — per-statement resource caps applied to the PreparedStatement (never the
 * singleton JdbcTemplate), and the executed SQL is always wrapped with the
 * {@code OFFSET ? ROWS FETCH NEXT ? ROWS ONLY} pagination clause.
 *
 * <p>Wave 4 (Plan 05): both tests enabled. SqlQueryServiceV4 instantiated with mocked
 * {@link JdbcTemplate} + mocked {@link SqlSearchConfigServiceV4}; no live DB.
 */
class SqlQueryServiceV4Test {

    private static SqlTabConfigV4 reconSummaryTab() {
        SqlTabConfigV4 tab = new SqlTabConfigV4();
        tab.setKey("reconSummary");
        tab.setLabel("Recon Summary (SQL)");
        tab.setQuery("SELECT recon, app_id FROM rectrace_core WHERE recon IS NOT NULL FETCH FIRST 1000 ROWS ONLY");
        ColumnDefinition reconCol = new ColumnDefinition();
        reconCol.setField("recon");
        ColumnDefinition appIdCol = new ColumnDefinition();
        appIdCol.setField("app_id");
        tab.setColumns(List.of(reconCol, appIdCol));
        return tab;
    }

    @Test
    void perStatementCapsAppliedNotSingleton() throws Exception {
        JdbcTemplate jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        SqlSearchConfigServiceV4 configService = Mockito.mock(SqlSearchConfigServiceV4.class);
        when(configService.getTab("reconSummary")).thenReturn(Optional.of(reconSummaryTab()));

        Connection conn = Mockito.mock(Connection.class);
        PreparedStatement ps = Mockito.mock(PreparedStatement.class);
        ResultSet rs = Mockito.mock(ResultSet.class);
        when(conn.prepareStatement(any(String.class))).thenReturn(ps);
        when(ps.executeQuery()).thenReturn(rs);
        when(rs.next()).thenReturn(false);

        // Capture the PreparedStatementCreator lambda the service hands to JdbcTemplate.
        ArgumentCaptor<PreparedStatementCreator> creatorCaptor =
            ArgumentCaptor.forClass(PreparedStatementCreator.class);
        when(jdbcTemplate.execute(
                creatorCaptor.capture(),
                any(PreparedStatementCallback.class)))
            .thenReturn(Collections.emptyList());

        SqlQueryServiceV4 service = new SqlQueryServiceV4(jdbcTemplate, configService, 30, 500, 10_000);
        SSRMRequestV4 req = SSRMRequestV4.builder()
                .startRow(0)
                .endRow(100)
                .sortModel(Collections.emptyList())
                .filterModel(Collections.emptyMap())
                .build();
        service.executeTab("reconSummary", req);

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

    @Test
    void injectsOffsetFetchWrapper() throws Exception {
        JdbcTemplate jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        SqlSearchConfigServiceV4 configService = Mockito.mock(SqlSearchConfigServiceV4.class);
        when(configService.getTab("reconSummary")).thenReturn(Optional.of(reconSummaryTab()));

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

        SqlQueryServiceV4 service = new SqlQueryServiceV4(jdbcTemplate, configService, 30, 500, 10_000);
        SSRMRequestV4 req = SSRMRequestV4.builder()
                .startRow(0)
                .endRow(100)
                .sortModel(Collections.emptyList())
                .filterModel(Collections.emptyMap())
                .build();
        service.executeTab("reconSummary", req);

        creatorCaptor.getValue().createPreparedStatement(conn);

        String executedSql = sqlCaptor.getValue();
        // Always-injected paging wrapper — SQL-05 defense in depth.
        org.junit.jupiter.api.Assertions.assertTrue(
            executedSql.matches("(?is)^\\s*SELECT \\* FROM \\(.*\\) .* OFFSET \\? ROWS FETCH NEXT \\? ROWS ONLY\\s*$"),
            () -> "executed SQL must wrap configured query with OFFSET ? ROWS FETCH NEXT ? ROWS ONLY; got: " + executedSql);
    }
}
