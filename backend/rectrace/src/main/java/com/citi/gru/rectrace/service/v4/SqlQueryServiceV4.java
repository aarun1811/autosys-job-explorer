package com.citi.gru.rectrace.service.v4;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.ColumnMapRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementCallback;
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.stereotype.Service;

import com.citi.gru.rectrace.dto.v4.ColumnDefinition;
import com.citi.gru.rectrace.dto.v4.SSRMRequestV4;
import com.citi.gru.rectrace.dto.v4.SSRMResponseV4;
import com.citi.gru.rectrace.dto.v4.SortModel;
import com.citi.gru.rectrace.dto.v4.SqlTabConfigV4;

import lombok.extern.slf4j.Slf4j;

/**
 * Phase 5 / SQL-04 + SQL-05 + SQL-06 — request-time executor for config-driven SQL
 * tabs. Validates user-supplied sort/filter column names against the configured
 * {@code columns[].field} whitelist (does NOT inherit
 * {@code OracleServiceV4.buildOrderByClause}'s SQL-injection bug, CONCERNS.md), wraps the
 * configured query with {@code SELECT * FROM (<query>) sub [WHERE …] [ORDER BY …]
 * OFFSET ? ROWS FETCH NEXT ? ROWS ONLY} (SQL-05 defense in depth), applies per-statement
 * caps inside a {@link PreparedStatementCreator} via
 * {@link JdbcTemplate#execute(PreparedStatementCreator, PreparedStatementCallback)} (SQL-04
 * — singleton {@code readonlyJdbcTemplate} is NEVER mutated), and shapes the response for
 * AG-Grid's SSRM datasource (SQL-06).
 *
 * <p>{@code @Profile("!test")} mirrors {@link ReadonlyDataSourceConfig} so the bean is
 * excluded from {@code ContextLoadsTest}.
 */
@Profile("!test")
@Service
@Slf4j
public class SqlQueryServiceV4 {

    private final JdbcTemplate readonlyJdbcTemplate;
    private final SqlSearchConfigServiceV4 configService;
    private final int queryTimeoutSeconds;
    private final int fetchSize;
    private final int maxRows;

    public SqlQueryServiceV4(
            @Qualifier("readonlyJdbcTemplate") JdbcTemplate readonlyJdbcTemplate,
            SqlSearchConfigServiceV4 configService,
            // Pitfall 3 — name property with explicit `Seconds` suffix; JDBC setQueryTimeout is
            // seconds (NOT milliseconds). A property like `queryTimeout=30000` would silently
            // become an 8-hour timeout.
            @Value("${datasource.readonly.queryTimeoutSeconds:30}") int queryTimeoutSeconds,
            @Value("${datasource.readonly.fetchSize:500}") int fetchSize,
            @Value("${datasource.readonly.maxRows:10000}") int maxRows) {
        this.readonlyJdbcTemplate = readonlyJdbcTemplate;
        this.configService = configService;
        this.queryTimeoutSeconds = queryTimeoutSeconds;
        this.fetchSize = fetchSize;
        this.maxRows = maxRows;
    }

    /**
     * Execute a configured SQL tab with SSRM-shaped paging.
     *
     * @param tabKey configured tab key (must exist in {@code sql-search-config-v4.json})
     * @param req    SSRM request — start/end row, sortModel, filterModel
     * @return SSRM response — {@code rows} with lowercase keys, {@code lastRow} = -1 if more rows available
     * @throws IllegalArgumentException on unknown tabKey, non-whitelisted sort/filter column,
     *                                  unsupported filter operator, or invalid sort direction
     */
    public SSRMResponseV4 executeTab(String tabKey, SSRMRequestV4 req) {
        SqlTabConfigV4 tab = configService.getTab(tabKey)
                .orElseThrow(() -> new IllegalArgumentException("Unknown SQL tab: " + tabKey));

        // Whitelist drawn from the configured columns[].field list. ANY identifier interpolated
        // into the wrapped SQL string MUST appear in this set (negative gate verified by tests).
        Set<String> whitelistedFields = (tab.getColumns() == null)
                ? java.util.Collections.emptySet()
                : tab.getColumns().stream()
                        .map(ColumnDefinition::getField)
                        .collect(Collectors.toSet());

        List<Object> params = new ArrayList<>();

        // WHERE clause (filter) — built from validated columns + parameterized binds.
        String whereClause = buildFilterClause(req.getFilterModel(), whitelistedFields, params);

        // ORDER BY clause (sort) — built from whitelisted colIds + ASC/DESC keywords only.
        String orderByClause = buildOrderByClause(req.getSortModel(), whitelistedFields);

        int pageSize = req.getEndRow() - req.getStartRow();

        // SQL-05: outer wrapper ALWAYS applies OFFSET / FETCH NEXT. Pitfall 4 — this
        // is belt-and-suspenders complement to PreparedStatement.setMaxRows on the inner
        // PreparedStatement. The configured query is treated as an opaque subquery.
        // TODO Phase 6: encourage configured queries to include a stable inner ORDER BY
        // for deterministic paging when no sortModel is supplied.
        String wrappedSql = "SELECT * FROM (" + tab.getQuery() + ") sub WHERE 1=1"
                + whereClause
                + (orderByClause.isEmpty() ? "" : " " + orderByClause)
                + " OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";

        params.add(req.getStartRow());
        params.add(pageSize);

        log.debug("SQL tab [{}] executing wrapped query: {} (params={})", tabKey, wrappedSql, params);

        // SQL-04: per-statement caps via PreparedStatementCreator. NEVER mutate the singleton
        // readonlyJdbcTemplate's setQueryTimeout/setFetchSize/setMaxRows.
        final String executedSql = wrappedSql;
        final List<Object> bindParams = params;
        List<Map<String, Object>> rawRows = readonlyJdbcTemplate.execute(
                (PreparedStatementCreator) conn -> {
                    PreparedStatement ps = conn.prepareStatement(executedSql);
                    // Per-statement caps — applied INSIDE the lambda on the per-call PreparedStatement.
                    ps.setQueryTimeout(queryTimeoutSeconds);
                    ps.setFetchSize(fetchSize);
                    ps.setMaxRows(maxRows);
                    for (int i = 0; i < bindParams.size(); i++) {
                        ps.setObject(i + 1, bindParams.get(i));
                    }
                    return ps;
                },
                (PreparedStatementCallback<List<Map<String, Object>>>) ps -> {
                    // Pitfall 6 — try-with-resources on ResultSet so the cursor closes even on exception.
                    try (ResultSet rs = ps.executeQuery()) {
                        ColumnMapRowMapper mapper = new ColumnMapRowMapper();
                        List<Map<String, Object>> rows = new ArrayList<>();
                        int n = 0;
                        while (rs.next()) {
                            rows.add(mapper.mapRow(rs, n++));
                        }
                        return rows;
                    }
                });

        if (rawRows == null) {
            rawRows = new ArrayList<>();
        }

        // Pitfall 5 — Oracle JDBC returns UPPERCASE column names; AG-Grid columnDefs are lowercase.
        List<Map<String, Object>> rows = normalizeColumnNames(rawRows);

        // SSRM lastRow convention: -1 = more rows available; otherwise the absolute index of the last row.
        int lastRow = (rows.size() < pageSize)
                ? req.getStartRow() + rows.size()
                : -1;

        log.info("SQL tab [{}] executed: {} rows returned (startRow={}, pageSize={}, lastRow={})",
                tabKey, rows.size(), req.getStartRow(), pageSize, lastRow);

        return SSRMResponseV4.builder()
                .rows(rows)
                .lastRow(lastRow)
                .build();
    }

    /**
     * Build the ORDER BY clause from {@code sortModel}. Every {@code colId} is checked against
     * the {@code whitelistedFields} BEFORE string interpolation — this is the surgery that
     * inherits NONE of the {@code OracleServiceV4.buildOrderByClause} SQL-injection bug flagged
     * in CONCERNS.md.
     */
    private String buildOrderByClause(List<SortModel> sortModel, Set<String> whitelistedFields) {
        if (sortModel == null || sortModel.isEmpty()) {
            return "";
        }
        List<String> parts = new ArrayList<>();
        for (SortModel s : sortModel) {
            String colId = s.getColId();
            // Whitelist gate — MUST precede any interpolation.
            if (!whitelistedFields.contains(colId)) {
                throw new IllegalArgumentException("Sort column not allowed: " + colId);
            }
            String sort = s.getSort();
            if (sort == null
                    || (!"asc".equalsIgnoreCase(sort) && !"desc".equalsIgnoreCase(sort))) {
                throw new IllegalArgumentException(
                        "Sort direction must be 'asc' or 'desc'; got: " + sort);
            }
            parts.add(colId + " " + sort.toUpperCase());
        }
        return "ORDER BY " + String.join(", ", parts);
    }

    /**
     * Build the WHERE-clause suffix (always {@code " AND …"} so it appends after a leading
     * {@code WHERE 1=1}). Phase 5 supports two operators: {@code equals} and {@code contains}.
     * Filter values pass as parameterized binds — never concatenated.
     */
    @SuppressWarnings("unchecked")
    private String buildFilterClause(
            Map<String, Object> filterModel,
            Set<String> whitelistedFields,
            List<Object> params) {
        if (filterModel == null || filterModel.isEmpty()) {
            return "";
        }
        List<String> parts = new ArrayList<>();
        for (Map.Entry<String, Object> entry : filterModel.entrySet()) {
            String column = entry.getKey();
            // Whitelist gate — MUST precede any interpolation.
            if (!whitelistedFields.contains(column)) {
                throw new IllegalArgumentException("Filter column not allowed: " + column);
            }
            Map<String, Object> def = (Map<String, Object>) entry.getValue();
            if (def == null || def.get("filter") == null) {
                continue;
            }
            String value = def.get("filter").toString();
            String op = def.getOrDefault("type", "equals").toString().toLowerCase();
            switch (op) {
                case "equals":
                    parts.add(column + " = ?");
                    params.add(value);
                    break;
                case "contains":
                    parts.add("UPPER(" + column + ") LIKE UPPER(?)");
                    params.add("%" + value + "%");
                    break;
                default:
                    // Phase 6 will extend the operator set. Phase 5 rejects to surface unknown
                    // operators rather than silently degrading.
                    throw new IllegalArgumentException("Unsupported filter operator: " + op);
            }
        }
        return parts.isEmpty() ? "" : " AND " + String.join(" AND ", parts);
    }

    /**
     * Pitfall 5 — Oracle JDBC returns UPPERCASE column names by default; AG-Grid column
     * definitions are lowercase. Mirror {@code OracleServiceV4.normalizeColumnNames}.
     */
    private List<Map<String, Object>> normalizeColumnNames(List<Map<String, Object>> rows) {
        List<Map<String, Object>> out = new ArrayList<>(rows.size());
        for (Map<String, Object> row : rows) {
            Map<String, Object> normalized = new LinkedHashMap<>();
            row.forEach((key, value) -> normalized.put(key.toLowerCase(), value));
            out.add(normalized);
        }
        return out;
    }
}
