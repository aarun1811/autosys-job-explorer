package com.citi.gru.rectrace.loader;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;

import com.citi.gru.rectrace.loader.dto.LoaderJobDefV4;

import co.elastic.clients.elasticsearch._helpers.bulk.BulkIngester;
import lombok.extern.slf4j.Slf4j;

/**
 * Phase 6 / LOADER-03 + LOADER-04 + LOADER-05 — the actual Oracle → Elasticsearch loader.
 *
 * <h2>What {@link #run(LoaderJobDefV4)} does</h2>
 * <ol>
 *   <li>Insert a {@code RUNNING} row into {@code loader_run_history} via
 *       {@link LoaderRunHistoryService#recordRunStart(String)}; capture the {@code startedAt}
 *       timestamp as the compound-PK component for the later update.</li>
 *   <li>Reset the per-job listener's failed-item counter so cross-run state never leaks.</li>
 *   <li>Stream the source SELECT via
 *       {@link JdbcTemplate#query(org.springframework.jdbc.core.PreparedStatementCreator, RowCallbackHandler)}
 *       with {@code PreparedStatement.setFetchSize(1000)} — Pitfall L10. {@code query(sql, RowMapper)}
 *       and {@code queryForList} both materialize the full result set into a {@code List<Map>}
 *       which OOMs on multi-million-row Oracle tables. The fetch-size hint tells Oracle JDBC
 *       to stream in 1 000-row chunks.</li>
 *   <li>For each row: build a lowercase-keyed {@code Map<String,Object>}, compute the
 *       deterministic 16-hex-char document ID via {@link DocumentIdHasher#hash}, and call
 *       {@code BulkIngester.add(IndexOperation.index(alias).id(docId).document(row))}.
 *       The target is the configured <em>alias</em>, never a literal index — LOADER-03.</li>
 *   <li>{@code ingester.flush()} forces the in-flight queue to drain so the listener's failure
 *       counter is settled before classification. {@code close()} is deliberately NOT called
 *       here — that belongs to {@code LoaderJobRegistry.@PreDestroy} (Pitfall L3).</li>
 *   <li>If {@code listener.getFailedItemCount() > 0}, record FAILED with a count-summary
 *       message. Otherwise record SUCCESS with the row count + duration.</li>
 * </ol>
 *
 * <h2>Broad {@code catch (Throwable)} (research Anti-Patterns)</h2>
 * Any uncaught exception during the streaming query or flush is converted to a FAILED row
 * in {@code loader_run_history}. The full stack goes to the app log; an 8 KB-truncated
 * fingerprint is persisted for fast admin-endpoint surfacing. <em>Silently dropping</em>
 * an exception would be the bug — recording it is the design.
 *
 * <h2>Lowercase column keys</h2>
 * Oracle JDBC returns column labels in upper-case ({@code "JOB_NAME"}) but the ES
 * {@code _source} convention plus the {@code search-config-v4.json} fields ({@code "job_name"})
 * are lowercase. {@link #rowToMap(ResultSet)} lower-cases the labels — same convention as
 * {@code SqlQueryServiceV4} (Phase 5).
 */
@ConditionalOnProperty(name = "rectrace.loader.enabled", havingValue = "true", matchIfMissing = true)
@Service
@Profile("!test")
@Slf4j
public class OracleToEsLoaderJob {

    private final LoaderJobRegistry registry;
    private final LoaderRunHistoryService runHistory;
    private final DocumentIdHasher hasher;
    private final JdbcTemplate loaderJdbc;

    public OracleToEsLoaderJob(LoaderJobRegistry registry,
            LoaderRunHistoryService runHistory,
            DocumentIdHasher hasher,
            @Qualifier("loaderJdbcTemplate") JdbcTemplate loaderJdbc) {
        this.registry = registry;
        this.runHistory = runHistory;
        this.hasher = hasher;
        this.loaderJdbc = loaderJdbc;
    }

    /**
     * Execute one run of {@code def}. Caller is responsible for holding the per-job ShedLock.
     * Never throws — failures are captured in {@code loader_run_history}.
     */
    public void run(LoaderJobDefV4 def) {
        final String key = def.getKey();
        final String alias = def.getTarget().getAlias();
        final Instant startedAt = runHistory.recordRunStart(key);
        final long t0 = System.nanoTime();
        final AtomicLong rowCount = new AtomicLong(0);

        BulkIngester<String> ingester = registry.ingesterFor(key);
        LoaderBulkListener listener = registry.listenerFor(key);
        if (ingester == null || listener == null) {
            // Defensive — Plan 04 Task 1 invariant says these are populated for every job.
            long durationMs = elapsedMs(t0);
            runHistory.recordRunFailure(key, startedAt, durationMs,
                    "LoaderJobRegistry has no ingester/listener for job [" + key + "]");
            log.error("Loader [{}] aborted: no ingester/listener registered", key);
            return;
        }
        listener.resetFailedItemCount();

        try {
            loaderJdbc.query(con -> {
                PreparedStatement ps = con.prepareStatement(def.getSource().getQuery());
                ps.setFetchSize(1000);
                return ps;
            }, (RowCallbackHandler) rs -> {
                Map<String, Object> row = addSuggestFields(rowToMap(rs));
                String docId = hasher.hash(def.getSource().getPrimaryKey(), row);
                ingester.add(op -> op.index(idx -> idx
                        .index(alias)
                        .id(docId)
                        .document(row)), key + ":" + docId);
                rowCount.incrementAndGet();
            });
            ingester.flush();

            long durationMs = elapsedMs(t0);
            long failed = listener.getFailedItemCount();
            if (failed > 0) {
                String msg = "Bulk listener recorded " + failed + " failed item(s) — see app logs for details";
                runHistory.recordRunFailure(key, startedAt, durationMs, msg);
                log.warn("Loader [{}] completed with failures: rows={} failed={} durationMs={}",
                        key, rowCount.get(), failed, durationMs);
            } else {
                runHistory.recordRunSuccess(key, startedAt, rowCount.get(), durationMs);
                log.info("Loader [{}] succeeded: rows={} durationMs={}",
                        key, rowCount.get(), durationMs);
            }
        } catch (Throwable t) {
            long durationMs = elapsedMs(t0);
            String errorMessage = t.getClass().getSimpleName() + ": " + t.getMessage()
                    + "\n" + Arrays.stream(t.getStackTrace())
                            .limit(4)
                            .map(StackTraceElement::toString)
                            .collect(Collectors.joining("\n"));
            runHistory.recordRunFailure(key, startedAt, durationMs, errorMessage);
            log.error("Loader [{}] failed after {} ms (rows processed={})",
                    key, durationMs, rowCount.get(), t);
            // Do NOT rethrow — the ticker's executeWithLock would also swallow, and the
            // run-history row already records the failure for admin-surface visibility.
        }
    }

    /**
     * Convert one JDBC row to a lowercase-keyed {@code LinkedHashMap} (preserves column order).
     */
    private static Map<String, Object> rowToMap(ResultSet rs) throws SQLException {
        ResultSetMetaData md = rs.getMetaData();
        int n = md.getColumnCount();
        Map<String, Object> row = new LinkedHashMap<>(n * 2);
        for (int i = 1; i <= n; i++) {
            String label = md.getColumnLabel(i);
            row.put(label == null ? null : label.toLowerCase(), rs.getObject(i));
        }
        return row;
    }

    /**
     * Source column → completion-suggester field. Mirrors the {@code *_suggest}
     * completion fields in the ES mapping and
     * {@code SuggestionService.suggestionFields}. Adding a suggest field is a
     * 3-touch change: this map, the ES mapping, and SuggestionService.
     */
    private static final Map<String, String> SUGGEST_SOURCE_TO_FIELD = Map.of(
            "recon", "recon_suggest",
            "box_name", "box_name_suggest",
            "machine", "machine_suggest",
            "run_calendar", "run_calendar_suggest",
            "exclude_calendar", "exclude_calendar_suggest",
            "job_name", "job_name_suggest",
            "sub_acc", "sub_acc_suggest",
            "set_id", "set_id_suggest");

    /**
     * Enrich a row map with completion-suggester inputs derived from source
     * columns so typeahead works on loader-written docs (prod parity with the
     * local seed). Blank, missing, or non-String sources are skipped — the ES
     * {@code completion} type rejects empty input. Mutates and returns the same
     * map. Package-private + static for direct unit testing.
     */
    static Map<String, Object> addSuggestFields(Map<String, Object> row) {
        for (Map.Entry<String, String> e : SUGGEST_SOURCE_TO_FIELD.entrySet()) {
            Object v = row.get(e.getKey());
            if (v instanceof String s && !s.isBlank()) {
                row.put(e.getValue(), s);
            }
        }
        return row;
    }

    private static long elapsedMs(long t0) {
        return Duration.ofNanos(System.nanoTime() - t0).toMillis();
    }
}
