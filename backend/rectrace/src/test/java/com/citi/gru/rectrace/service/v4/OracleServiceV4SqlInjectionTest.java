package com.citi.gru.rectrace.service.v4;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.citi.gru.rectrace.dto.v4.CategoryConfigV4;
import com.citi.gru.rectrace.dto.v4.ColumnDefinition;
import com.citi.gru.rectrace.dto.v4.SSRMRequestV4;
import com.citi.gru.rectrace.dto.v4.SortModel;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Locks the column-name SQL-injection surface in OracleServiceV4. Every method that
 * concatenates a user-controlled column name into SQL must consult the per-category
 * {@link ColumnNameWhitelist}.
 */
class OracleServiceV4SqlInjectionTest {

    private static CategoryConfigV4 fileNameCategory() {
        return CategoryConfigV4.builder()
            .key("fileName")
            .searchColumn("file_name_pattern")
            .columns(List.of(
                ColumnDefinition.builder().field("file_name_pattern").build(),
                ColumnDefinition.builder().field("app_id").build(),
                ColumnDefinition.builder().field("execution_order").build()
            ))
            .build();
    }

    private static ColumnNameWhitelist fileNameWhitelist() {
        return ColumnNameWhitelist.forCategory(fileNameCategory());
    }

    // ---------- buildOrderByClause ----------

    @Test
    void buildOrderByRejectsMaliciousColId() {
        SSRMRequestV4 request = SSRMRequestV4.builder()
            .sortModel(List.of(SortModel.builder()
                .colId("app_id; DROP TABLE rectrace_core")
                .sort("asc")
                .build()))
            .build();

        assertThrows(
            IllegalArgumentException.class,
            () -> OracleServiceV4.buildOrderByClause(request, fileNameWhitelist()));
    }

    @Test
    void buildOrderByRejectsMaliciousSortDirection() {
        SSRMRequestV4 request = SSRMRequestV4.builder()
            .sortModel(List.of(SortModel.builder()
                .colId("app_id")
                .sort("asc; DROP TABLE rectrace_core")
                .build()))
            .build();

        assertThrows(
            IllegalArgumentException.class,
            () -> OracleServiceV4.buildOrderByClause(request, fileNameWhitelist()));
    }

    @Test
    void buildOrderByProducesValidSqlForLegitimateInput() {
        SSRMRequestV4 request = SSRMRequestV4.builder()
            .sortModel(List.of(
                SortModel.builder().colId("app_id").sort("asc").build(),
                SortModel.builder().colId("file_name_pattern").sort("desc").build()))
            .build();

        String orderBy = OracleServiceV4.buildOrderByClause(request, fileNameWhitelist());

        assertEquals("ORDER BY app_id ASC, file_name_pattern DESC", orderBy);
    }

    @Test
    void buildOrderByReturnsEmptyForNoSortModel() {
        SSRMRequestV4 request = SSRMRequestV4.builder().build();
        assertEquals("", OracleServiceV4.buildOrderByClause(request, fileNameWhitelist()));
    }

    // ---------- buildFilterClause ----------

    @Test
    void buildFilterClauseRejectsMaliciousColumnKey() {
        Map<String, Object> filterModel = new HashMap<>();
        Map<String, Object> filterDef = new HashMap<>();
        filterDef.put("filter", "value");
        filterDef.put("type", "equals");
        filterModel.put("app_id) OR (1=1", filterDef);

        assertThrows(
            IllegalArgumentException.class,
            () -> OracleServiceV4.buildFilterClause(filterModel, new ArrayList<>(), fileNameWhitelist()));
    }

    @Test
    void buildFilterClauseAcceptsLegitimateColumn() {
        Map<String, Object> filterModel = new HashMap<>();
        Map<String, Object> filterDef = new HashMap<>();
        filterDef.put("filter", "abc");
        filterDef.put("type", "equals");
        filterModel.put("app_id", filterDef);

        List<Object> params = new ArrayList<>();
        String clause = OracleServiceV4.buildFilterClause(filterModel, params, fileNameWhitelist());

        assertTrue(clause.contains("app_id = ?"),
            () -> "expected 'app_id = ?' in clause, got: " + clause);
        assertEquals(1, params.size());
        assertEquals("abc", params.get(0));
    }

    @Test
    void buildFilterClauseReturnsEmptyForNullFilterModel() {
        assertEquals(
            "",
            OracleServiceV4.buildFilterClause(null, new ArrayList<>(), fileNameWhitelist()));
    }

    // ---------- buildSelectClause ----------

    @Test
    void buildSelectClauseRejectsMaliciousVisibleColumn() {
        List<String> visibleColumns = List.of("app_id", "1; DROP TABLE rectrace_core");

        assertThrows(
            IllegalArgumentException.class,
            () -> OracleServiceV4.buildSelectClause(visibleColumns, List.of(), fileNameWhitelist()));
    }

    @Test
    void buildSelectClauseRejectsMaliciousGroupColumn() {
        List<String> visibleColumns = List.of("app_id");
        List<String> groupColumns = List.of("file_name_pattern OR 1=1");

        assertThrows(
            IllegalArgumentException.class,
            () -> OracleServiceV4.buildSelectClause(visibleColumns, groupColumns, fileNameWhitelist()));
    }

    @Test
    void buildSelectClauseStripsFrontendOnlyColumnsAndKeepsLegitimateColumns() {
        // execution_order is in config.columns but is a frontend-only synthetic column that
        // OracleServiceV4 must strip from the SELECT (it does not exist as a real DB column).
        List<String> visibleColumns = List.of("app_id", "execution_order", "file_name_pattern");
        String selectClause = OracleServiceV4.buildSelectClause(visibleColumns, List.of(), fileNameWhitelist());

        assertTrue(selectClause.contains("app_id"));
        assertTrue(selectClause.contains("file_name_pattern"));
        assertTrue(!selectClause.contains("execution_order"),
            () -> "execution_order must be stripped, got: " + selectClause);
    }

    @Test
    void buildSelectClauseAcceptsAgGridAutoColumnAsSyntheticFrontendOnly() {
        // ag-Grid-AutoColumn is the AG-Grid synthetic group-display column. It is never a
        // real DB column. Whitelist validation must NOT reject it; buildSelectClause must
        // strip it (as a frontend-only column).
        List<String> visibleColumns = List.of("app_id", "ag-Grid-AutoColumn");
        String selectClause = assertDoesNotThrow(
            () -> OracleServiceV4.buildSelectClause(visibleColumns, List.of(), fileNameWhitelist()));

        assertTrue(selectClause.contains("app_id"));
        assertTrue(!selectClause.contains("ag-Grid-AutoColumn"),
            () -> "ag-Grid-AutoColumn must be stripped, got: " + selectClause);
    }

    // ---------- validateGroupColumns (the rowGroupCols WHERE-clause path) ----------

    @Test
    void validateGroupColumnsRejectsMaliciousColumn() {
        List<String> rowGroupCols = List.of("app_id", "file_name_pattern; SELECT * FROM v$session");

        assertThrows(
            IllegalArgumentException.class,
            () -> OracleServiceV4.validateGroupColumns(rowGroupCols, fileNameWhitelist()));
    }

    @Test
    void validateGroupColumnsAcceptsConfiguredColumns() {
        List<String> rowGroupCols = List.of("app_id", "file_name_pattern");

        assertDoesNotThrow(
            () -> OracleServiceV4.validateGroupColumns(rowGroupCols, fileNameWhitelist()));
    }

    @Test
    void validateGroupColumnsTolerantOfNullOrEmpty() {
        assertDoesNotThrow(() -> OracleServiceV4.validateGroupColumns(null, fileNameWhitelist()));
        assertDoesNotThrow(() -> OracleServiceV4.validateGroupColumns(List.of(), fileNameWhitelist()));
    }
}
