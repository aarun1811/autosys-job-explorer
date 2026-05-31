package com.citi.gru.rectrace.loader;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import com.citi.gru.rectrace.loader.dto.LoaderRunRecordV4;
import com.citi.gru.rectrace.loader.dto.LoaderRunStatus;

import lombok.extern.slf4j.Slf4j;

/**
 * Phase 6 / LOADER-06 + LOADER-07 — persists one row per loader run and prunes to the last 20
 * per job.
 *
 * <p>Writes to the {@code loader_run_history} Oracle table (DDL in
 * {@code rectrace-local-dev/schema/01-rectrace.sql}). Per D-6.16 the loader uses the primary
 * RECTRACE datasource — the {@code loaderJdbcTemplate} bean wraps it.
 *
 * <h2>Run lifecycle</h2>
 * <pre>
 *   Instant t0 = svc.recordRunStart(jobKey);     // INSERT status='RUNNING'
 *   ... loader does work ...
 *   svc.recordRunSuccess(jobKey, t0, rows, ms);   // UPDATE → SUCCESS + pruneToLast20
 *   // OR
 *   svc.recordRunFailure(jobKey, t0, ms, err);    // UPDATE → FAILED + pruneToLast20
 * </pre>
 *
 * <h2>Last-N retention (LOADER-07)</h2>
 * Each {@code recordRunSuccess} / {@code recordRunFailure} call invokes {@link #pruneToLast20}
 * which uses Oracle's {@code ROW_NUMBER() OVER (PARTITION BY job_key ORDER BY started_at DESC)}
 * analytic to keep exactly the 20 most-recent rows per job. The prune is scoped strictly to a
 * single job_key — concurrent prunes against different jobs never interact.
 *
 * <h2>{@code last_error} truncation (Pitfall L8 / Research A8)</h2>
 * Stack traces frequently exceed Oracle's CLOB-indexing comfort zone and may leak sensitive
 * tokens. {@link #recordRunFailure} truncates {@code errorMessage} to 8 192 characters before
 * binding.
 */
@ConditionalOnProperty(name = "rectrace.loader.enabled", havingValue = "true", matchIfMissing = true)
@Profile("!test")
@Service
@Slf4j
public class LoaderRunHistoryService {

    /** Pitfall L8 / Research A8 — cap for {@code last_error}. */
    static final int LAST_ERROR_MAX_CHARS = 8192;

    private static final String INSERT_RUNNING_SQL =
            "INSERT INTO loader_run_history (job_key, started_at, status) VALUES (?, ?, 'RUNNING')";

    private static final String UPDATE_SUCCESS_SQL =
            "UPDATE loader_run_history SET finished_at = ?, status = 'SUCCESS', row_count = ?, duration_ms = ? "
                    + "WHERE job_key = ? AND started_at = ?";

    private static final String UPDATE_FAILED_SQL =
            "UPDATE loader_run_history SET finished_at = ?, status = 'FAILED', duration_ms = ?, last_error = ? "
                    + "WHERE job_key = ? AND started_at = ?";

    private static final String PRUNE_SQL =
            "DELETE FROM loader_run_history "
                    + "WHERE job_key = ? "
                    + "  AND (job_key, started_at) NOT IN ( "
                    + "    SELECT job_key, started_at FROM ( "
                    + "      SELECT job_key, started_at, "
                    + "             ROW_NUMBER() OVER (PARTITION BY job_key ORDER BY started_at DESC) AS rn "
                    + "      FROM loader_run_history "
                    + "      WHERE job_key = ? "
                    + "    ) "
                    + "    WHERE rn <= 20 "
                    + "  )";

    private static final String LAST_N_SQL =
            "SELECT job_key, started_at, finished_at, status, row_count, last_error, duration_ms "
                    + "FROM (SELECT * FROM loader_run_history WHERE job_key = ? ORDER BY started_at DESC) "
                    + "WHERE ROWNUM <= ?";

    private final JdbcTemplate jdbc;

    public LoaderRunHistoryService(@Qualifier("loaderJdbcTemplate") JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Insert a new {@code RUNNING} row for the given job.
     *
     * @param jobKey loader job key (matches {@code LoaderJobDefV4.key})
     * @return the {@code started_at} timestamp used as the run's compound-PK component;
     *         callers must pass this back to {@link #recordRunSuccess} / {@link #recordRunFailure}.
     */
    public Instant recordRunStart(String jobKey) {
        // Pitfall L? — the loader_run_history.started_at column is TIMESTAMP(3); Instant.now()
        // carries nanosecond precision. Binding a sub-millisecond Instant on INSERT and the
        // SAME Instant on the WHERE clause of the UPDATE causes a phantom mismatch because
        // Oracle truncates to milliseconds on store but JDBC binds the full nanos for compare.
        // Truncate to millis here so the returned Instant exactly matches what Oracle stores.
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        jdbc.update(INSERT_RUNNING_SQL, jobKey, Timestamp.from(now));
        return now;
    }

    /**
     * Mark the run identified by {@code (jobKey, startedAt)} as {@code SUCCESS} and prune.
     */
    public void recordRunSuccess(String jobKey, Instant startedAt, long rowCount, long durationMs) {
        jdbc.update(UPDATE_SUCCESS_SQL,
                Timestamp.from(Instant.now()),
                rowCount,
                durationMs,
                jobKey,
                Timestamp.from(startedAt));
        pruneToLast20(jobKey);
    }

    /**
     * Mark the run identified by {@code (jobKey, startedAt)} as {@code FAILED} and prune.
     * {@code errorMessage} is truncated to {@value #LAST_ERROR_MAX_CHARS} characters
     * (Pitfall L8 / Research A8).
     */
    public void recordRunFailure(String jobKey, Instant startedAt, long durationMs, String errorMessage) {
        String truncated = errorMessage == null
                ? null
                : (errorMessage.length() > LAST_ERROR_MAX_CHARS
                        ? errorMessage.substring(0, LAST_ERROR_MAX_CHARS)
                        : errorMessage);
        jdbc.update(UPDATE_FAILED_SQL,
                Timestamp.from(Instant.now()),
                durationMs,
                truncated,
                jobKey,
                Timestamp.from(startedAt));
        pruneToLast20(jobKey);
    }

    /**
     * Retain the 20 most-recent rows for {@code jobKey}; delete the rest. Scoped strictly to
     * one job_key — other jobs are untouched (LOADER-07 race-safety).
     */
    public void pruneToLast20(String jobKey) {
        int deleted = jdbc.update(PRUNE_SQL, jobKey, jobKey);
        if (deleted > 0) {
            log.debug("Pruned {} loader_run_history row(s) for job_key={}", deleted, jobKey);
        }
    }

    /**
     * Return the {@code n} most-recent runs for {@code jobKey}, newest first.
     */
    public List<LoaderRunRecordV4> lastN(String jobKey, int n) {
        return jdbc.query(LAST_N_SQL, RUN_RECORD_MAPPER, jobKey, n);
    }

    private static final RowMapper<LoaderRunRecordV4> RUN_RECORD_MAPPER = (ResultSet rs, int rowNum) -> {
        LoaderRunRecordV4 rec = new LoaderRunRecordV4();
        rec.setJobKey(rs.getString("job_key"));

        Timestamp started = rs.getTimestamp("started_at");
        rec.setStartedAt(started == null ? null : started.toInstant());

        Timestamp finished = rs.getTimestamp("finished_at");
        rec.setFinishedAt(finished == null || rs.wasNull() ? null : finished.toInstant());

        String status = rs.getString("status");
        rec.setStatus(status == null ? null : LoaderRunStatus.valueOf(status));

        long rowCount = rs.getLong("row_count");
        rec.setRowCount(rs.wasNull() ? null : rowCount);

        String lastError = rs.getString("last_error");
        rec.setLastError(rs.wasNull() ? null : lastError);

        long durationMs = rs.getLong("duration_ms");
        rec.setDurationMs(rs.wasNull() ? null : durationMs);

        return rec;
    };

    static RowMapper<LoaderRunRecordV4> runRecordMapper() {
        return RUN_RECORD_MAPPER;
    }
}
