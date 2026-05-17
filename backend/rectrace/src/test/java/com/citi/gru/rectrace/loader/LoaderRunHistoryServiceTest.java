package com.citi.gru.rectrace.loader;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Phase 6 / LOADER-06 + LOADER-07 — SQL-and-binding contract for {@code LoaderRunHistoryService}.
 *
 * <p>The service is a thin shell over {@link JdbcTemplate}; the value being asserted is the
 * exact SQL shape and the parameter binding. A mocked {@code JdbcTemplate} captures both —
 * fast (no DB), focused (asserts the service's behavior, not Oracle's).
 *
 * <p>Live-Oracle smoke verification is owned by Plan 05's smoke scripts.
 */
class LoaderRunHistoryServiceTest {

    private JdbcTemplate jdbc;
    private LoaderRunHistoryService svc;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        svc = new LoaderRunHistoryService(jdbc);
    }

    @Test
    void recordRunStartInsertsRunningRow() {
        svc.recordRunStart("jobA");

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object> args = ArgumentCaptor.forClass(Object.class);
        verify(jdbc).update(sql.capture(), args.capture(), args.capture());

        assertThat(sql.getValue())
                .as("LOADER-06: recordRunStart must INSERT into loader_run_history with status=RUNNING")
                .contains("INSERT INTO loader_run_history")
                .contains("'RUNNING'");

        List<Object> bound = args.getAllValues();
        assertThat(bound).hasSize(2);
        assertThat(bound.get(0)).isEqualTo("jobA");
    }

    @Test
    void recordRunSuccessUpdatesRowToSuccess() {
        Instant t0 = Instant.parse("2026-05-17T10:00:00Z");
        svc.recordRunSuccess("jobA", t0, 42L, 12345L);

        // Capture every JdbcTemplate.update call's varargs; the UPDATE was first, then prune DELETE.
        ArgumentCaptor<Object> bind = ArgumentCaptor.forClass(Object.class);
        verify(jdbc).update(
                org.mockito.ArgumentMatchers.matches("(?s).*UPDATE loader_run_history SET.*'SUCCESS'.*"),
                bind.capture(), bind.capture(), bind.capture(), bind.capture(), bind.capture());

        List<Object> bound = bind.getAllValues();
        // finished_at, row_count, duration_ms, jobKey, started_at
        assertThat(bound).hasSize(5);
        assertThat(bound.get(1)).isEqualTo(42L);
        assertThat(bound.get(2)).isEqualTo(12345L);
        assertThat(bound.get(3)).isEqualTo("jobA");
    }

    @Test
    void recordRunFailureCapturesTruncatedError() {
        String huge = "x".repeat(80_000);
        Instant t0 = Instant.parse("2026-05-17T10:00:00Z");

        svc.recordRunFailure("jobA", t0, 1234L, huge);

        ArgumentCaptor<Object> bind = ArgumentCaptor.forClass(Object.class);
        verify(jdbc).update(
                org.mockito.ArgumentMatchers.matches("(?s).*UPDATE loader_run_history SET.*'FAILED'.*last_error.*"),
                bind.capture(), bind.capture(), bind.capture(), bind.capture(), bind.capture());

        List<Object> bound = bind.getAllValues();
        // finished_at, duration_ms, last_error, jobKey, started_at
        assertThat(bound).hasSize(5);
        assertThat(bound.get(1)).isEqualTo(1234L);
        assertThat(bound.get(2))
                .as("LOADER-06 / Pitfall L8: last_error must be truncated to exactly 8192 chars")
                .isInstanceOf(String.class);
        assertThat((String) bound.get(2)).hasSize(LoaderRunHistoryService.LAST_ERROR_MAX_CHARS);
        assertThat(bound.get(3)).isEqualTo("jobA");
    }

    @Test
    void pruneToLast20RetainsExactly20RowsPerJob() {
        when(jdbc.update(anyString(), eq("jobA"), eq("jobA"))).thenReturn(5);

        svc.pruneToLast20("jobA");

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).update(sql.capture(), eq("jobA"), eq("jobA"));

        // Analytic DELETE: ROW_NUMBER + rn <= 20 + DELETE FROM loader_run_history.
        String pruneSql = sql.getValue();
        assertThat(pruneSql).contains("ROW_NUMBER()");
        assertThat(pruneSql).contains("rn <= 20");
        assertThat(pruneSql).contains("DELETE FROM loader_run_history");
        // jobKey appears twice in the SQL — once outer WHERE, once inner WHERE.
        // The two `eq("jobA")` parameter matchers already pinned this above.
    }

    @Test
    void pruneIsScopedToOneJobKey() {
        svc.pruneToLast20("jobA");

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc, times(1)).update(sql.capture(), eq("jobA"), eq("jobA"));

        String pruneSql = sql.getValue();
        // Negative: no `OR` clause — prune is strictly per-job_key.
        assertThat(pruneSql.toUpperCase()).doesNotContain(" OR ");
        // Both outer and inner predicates filter on job_key=?
        // (count occurrences of "job_key = ?" — must be ≥ 2: outer DELETE + inner SELECT).
        int matches = (pruneSql.length() - pruneSql.replace("job_key = ?", "").length()) / "job_key = ?".length();
        assertThat(matches)
                .as("LOADER-07 prune scoping: job_key=? predicate must appear in both outer and inner SELECT")
                .isGreaterThanOrEqualTo(2);
    }
}
