package com.citi.gru.rectrace.service.v4;

import com.citi.gru.rectrace.dto.v4.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class OracleServiceV4 {
    
    private static final int BATCH_SIZE = 100;
    
    // Define frontend-only columns that don't exist in database
    private static final Set<String> FRONTEND_ONLY_COLUMNS = new HashSet<>(Arrays.asList(
        "execution_order",
        "actions",
        "ag-Grid-AutoColumn"
    ));
    
    @Autowired
    private JdbcTemplate jdbcTemplate;
    
    public SSRMResponseV4 fetchSSRMData(CategoryConfigV4 config, SSRMRequestV4 request) {
        // Validate request
        if (request.getInitialFilter() == null || request.getInitialFilter().getValues() == null || 
            request.getInitialFilter().getValues().isEmpty()) {
            log.warn("No initial filter values provided");
            return SSRMResponseV4.builder()
                    .rows(new ArrayList<>())
                    .lastRow(0)
                    .build();
        }
        
        // Determine query type based on grouping state
        boolean isGrouped = request.getRowGroupCols() != null && !request.getRowGroupCols().isEmpty();
        int groupingDepth = request.getGroupKeys() != null ? request.getGroupKeys().size() : 0;
        int totalGroupLevels = request.getRowGroupCols() != null ? request.getRowGroupCols().size() : 0;
        
        log.debug("SSRM Request - isGrouped: {}, groupingDepth: {}, totalGroupLevels: {}, rowGroupCols: {}, groupKeys: {}", 
                isGrouped, groupingDepth, totalGroupLevels, request.getRowGroupCols(), request.getGroupKeys());
        
        try {
            if (!isGrouped) {
                // No grouping - fetch flat data
                return fetchFlatData(config, request);
            } else if (groupingDepth == 0) {
                // Root level - fetch first level groups
                return fetchGroupedData(config, request);
            } else if (groupingDepth < totalGroupLevels) {
                // Intermediate level - fetch next level groups
                return fetchNextLevelGroups(config, request);
            } else {
                // All groups expanded - fetch detail rows
                return fetchDetailRows(config, request);
            }
        } catch (Exception e) {
            log.error("Failed to fetch SSRM data", e);
            return SSRMResponseV4.builder()
                    .rows(new ArrayList<>())
                    .lastRow(0)
                    .build();
        }
    }
    
    private SSRMResponseV4 fetchGroupedData(CategoryConfigV4 config, SSRMRequestV4 request) {
        String groupColumn = request.getRowGroupCols().get(0);
        List<String> filterValues = request.getInitialFilter().getValues();
        
        // Build parameters for subquery
        List<Object> subqueryParams = new ArrayList<>(filterValues);
        
        // Build SQL for grouped view with count check to exclude empty groups
        StringBuilder sqlBuilder = new StringBuilder(String.format(
            "SELECT %s as group_value FROM (SELECT %s, COUNT(*) as cnt FROM %s WHERE %s IN (%s)",
            groupColumn,
            groupColumn,
            config.getOracle().getTable(),
            config.getSearchColumn(),
            String.join(",", Collections.nCopies(filterValues.size(), "?"))
        ));
        
        // Add filter clauses to subquery
        String filterClause = buildFilterClause(request.getFilterModel(), subqueryParams);
        sqlBuilder.append(filterClause);
        
        // Complete subquery with GROUP BY and HAVING to exclude empty groups
        sqlBuilder.append(String.format(" GROUP BY %s HAVING COUNT(*) > 0) subq ORDER BY %s", 
            groupColumn, groupColumn));
        
        // Add pagination
        sqlBuilder.append(" OFFSET ? ROWS FETCH NEXT ? ROWS ONLY");
        
        // Build final parameters for main query
        List<Object> params = new ArrayList<>(subqueryParams);
        params.add(request.getStartRow());
        params.add(Math.min(BATCH_SIZE, request.getEndRow() - request.getStartRow()));
        
        log.debug("Executing grouped query with {} filter values and {} filters", 
                filterValues.size(), request.getFilterModel() != null ? request.getFilterModel().size() : 0);
        
        // Execute query
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sqlBuilder.toString(), params.toArray());
        
        // Transform to AG-Grid format
        List<Map<String, Object>> gridRows = rows.stream()
            .map(row -> {
                Map<String, Object> gridRow = new HashMap<>();
                Object value = row.get("GROUP_VALUE");
                if (value != null) {
                    gridRow.put(groupColumn, value.toString());
                }
                return gridRow;
            })
            .collect(Collectors.toList());
        
        // For groups, we use -1 to indicate unknown total (AG-Grid will handle this)
        // This avoids the extra count query and the parameter mismatch issue
        return SSRMResponseV4.builder()
            .rows(gridRows)
            .lastRow(rows.size() < BATCH_SIZE ? request.getStartRow() + rows.size() : -1)
            .build();
    }
    
    private SSRMResponseV4 fetchNextLevelGroups(CategoryConfigV4 config, SSRMRequestV4 request) {
        // Fetch groups for the next level of hierarchy
        List<String> filterValues = request.getInitialFilter().getValues();
        List<String> groupColumns = request.getRowGroupCols();
        List<String> groupValues = request.getGroupKeys();
        
        // The next column to group by
        String nextGroupColumn = groupColumns.get(groupValues.size());
        
        // Build WHERE clause for all previous group levels
        StringBuilder whereClause = new StringBuilder();
        List<Object> queryParams = new ArrayList<>(filterValues);
        
        for (int i = 0; i < groupValues.size(); i++) {
            whereClause.append(" AND ").append(groupColumns.get(i)).append(" = ?");
            queryParams.add(groupValues.get(i));
        }
        
        // Build SQL for next level groups with count check to exclude empty groups
        StringBuilder sqlBuilder = new StringBuilder(String.format(
            "SELECT %s as group_value FROM (SELECT %s, COUNT(*) as cnt FROM %s WHERE %s IN (%s)%s",
            nextGroupColumn,
            nextGroupColumn,
            config.getOracle().getTable(),
            config.getSearchColumn(),
            String.join(",", Collections.nCopies(filterValues.size(), "?")),
            whereClause.toString()
        ));
        
        // Add filter clauses
        String filterClause = buildFilterClause(request.getFilterModel(), queryParams);
        sqlBuilder.append(filterClause);
        
        // Complete subquery with GROUP BY and HAVING to exclude empty groups
        sqlBuilder.append(String.format(" GROUP BY %s HAVING COUNT(*) > 0) subq ORDER BY %s", 
            nextGroupColumn, nextGroupColumn));
        
        // Add pagination
        sqlBuilder.append(" OFFSET ? ROWS FETCH NEXT ? ROWS ONLY");
        
        // Add pagination parameters
        queryParams.add(request.getStartRow());
        queryParams.add(Math.min(BATCH_SIZE, request.getEndRow() - request.getStartRow()));
        
        log.debug("Executing next level group query for column: {} with {} previous groups", 
                nextGroupColumn, groupValues.size());
        
        // Execute query
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sqlBuilder.toString(), queryParams.toArray());
        
        // Transform to AG-Grid format
        List<Map<String, Object>> gridRows = rows.stream()
            .map(row -> {
                Map<String, Object> gridRow = new HashMap<>();
                Object value = row.get("GROUP_VALUE");
                if (value == null) {
                    value = row.get("group_value");
                }
                if (value != null) {
                    gridRow.put(nextGroupColumn, value.toString());
                }
                return gridRow;
            })
            .collect(Collectors.toList());
        
        return SSRMResponseV4.builder()
            .rows(gridRows)
            .lastRow(rows.size() < BATCH_SIZE ? request.getStartRow() + rows.size() : -1)
            .build();
    }
    
    private SSRMResponseV4 fetchDetailRows(CategoryConfigV4 config, SSRMRequestV4 request) {
        // This method fetches actual detail rows when all groups are expanded
        List<String> filterValues = request.getInitialFilter().getValues();
        List<String> groupColumns = request.getRowGroupCols();
        List<String> groupValues = request.getGroupKeys();
        
        // Build WHERE clause for all group levels
        StringBuilder whereClause = new StringBuilder();
        
        // Add conditions for each group level
        for (int i = 0; i < groupColumns.size() && i < groupValues.size(); i++) {
            whereClause.append(" AND ").append(groupColumns.get(i)).append(" = ?");
        }
        
        // Build SELECT clause based on visible columns
        String selectClause = buildSelectClause(request.getVisibleColumns(), groupColumns);
        
        // For count query with DISTINCT, we need to count distinct combinations
        List<Object> countParams = new ArrayList<>(filterValues);
        for (String groupValue : groupValues) {
            countParams.add(groupValue);
        }
        
        String countSql;
        if (selectClause.startsWith("DISTINCT ")) {
            // When using DISTINCT, count the distinct rows
            String distinctColumns = selectClause.substring("DISTINCT ".length());
            countSql = String.format(
                "SELECT COUNT(*) FROM (SELECT DISTINCT %s FROM %s WHERE %s IN (%s)%s",
                distinctColumns,
                config.getOracle().getTable(),
                config.getSearchColumn(),
                String.join(",", Collections.nCopies(filterValues.size(), "?")),
                whereClause.toString()
            );
            // Add filter clauses to count query
            String filterClause = buildFilterClause(request.getFilterModel(), countParams);
            countSql += filterClause + ")";
        } else {
            countSql = String.format(
                "SELECT COUNT(*) FROM %s WHERE %s IN (%s)%s",
                config.getOracle().getTable(),
                config.getSearchColumn(),
                String.join(",", Collections.nCopies(filterValues.size(), "?")),
                whereClause.toString()
            );
            // Add filter clauses to count query
            String filterClause = buildFilterClause(request.getFilterModel(), countParams);
            countSql += filterClause;
        }
        
        Integer totalCount = jdbcTemplate.queryForObject(countSql, countParams.toArray(), Integer.class);
        
        // Build data query with sorting and pagination
        List<Object> dataParams = new ArrayList<>(filterValues);
        
        // Add group values as parameters
        for (String groupValue : groupValues) {
            dataParams.add(groupValue);
        }
        
        StringBuilder dataSql = new StringBuilder(String.format(
            "SELECT %s FROM %s WHERE %s IN (%s)%s",
            selectClause,
            config.getOracle().getTable(),
            config.getSearchColumn(),
            String.join(",", Collections.nCopies(filterValues.size(), "?")),
            whereClause.toString()
        ));
        
        // Add filter clauses to data query
        dataSql.append(buildFilterClause(request.getFilterModel(), dataParams));
        
        // Add sorting if specified
        String orderByClause = buildOrderByClause(request);
        if (!orderByClause.isEmpty()) {
            dataSql.append(" ").append(orderByClause);
        }
        
        // Add pagination
        dataSql.append(" OFFSET ? ROWS FETCH NEXT ? ROWS ONLY");
        
        dataParams.add(request.getStartRow());
        dataParams.add(Math.min(BATCH_SIZE, request.getEndRow() - request.getStartRow()));
        
        log.debug("Executing detail query for groups: {}", groupValues);
        
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(dataSql.toString(), dataParams.toArray());
        
        // Convert column names to lowercase for consistency
        List<Map<String, Object>> normalizedRows = normalizeColumnNames(rows);
        
        return SSRMResponseV4.builder()
            .rows(normalizedRows)
            .lastRow(totalCount != null ? totalCount : 0)
            .build();
    }
    
    private SSRMResponseV4 fetchFlatData(CategoryConfigV4 config, SSRMRequestV4 request) {
        List<String> filterValues = request.getInitialFilter().getValues();
        
        // Build SELECT clause based on visible columns
        String selectClause = buildSelectClause(request.getVisibleColumns(), request.getRowGroupCols());
        
        // Prepare parameters for count query
        List<Object> countParams = new ArrayList<>(filterValues);
        
        // Get total count with filters
        String countSql;
        if (selectClause.startsWith("DISTINCT ")) {
            // When using DISTINCT, count the distinct rows
            String distinctColumns = selectClause.substring("DISTINCT ".length());
            countSql = String.format(
                "SELECT COUNT(*) FROM (SELECT DISTINCT %s FROM %s WHERE %s IN (%s)",
                distinctColumns,
                config.getOracle().getTable(),
                config.getSearchColumn(),
                String.join(",", Collections.nCopies(filterValues.size(), "?"))
            );
            // Add filter clauses to count query
            String filterClause = buildFilterClause(request.getFilterModel(), countParams);
            countSql += filterClause + ")";
        } else {
            countSql = String.format(
                "SELECT COUNT(*) FROM %s WHERE %s IN (%s)",
                config.getOracle().getTable(),
                config.getSearchColumn(),
                String.join(",", Collections.nCopies(filterValues.size(), "?"))
            );
            // Add filter clauses to count query
            String filterClause = buildFilterClause(request.getFilterModel(), countParams);
            countSql += filterClause;
        }
        
        Integer totalCount = jdbcTemplate.queryForObject(countSql, countParams.toArray(), Integer.class);
        
        // Build data query
        List<Object> dataParams = new ArrayList<>(filterValues);
        StringBuilder dataSql = new StringBuilder(String.format(
            "SELECT %s FROM %s WHERE %s IN (%s)",
            selectClause,
            config.getOracle().getTable(),
            config.getSearchColumn(),
            String.join(",", Collections.nCopies(filterValues.size(), "?"))
        ));
        
        // Add filter clauses to data query
        dataSql.append(buildFilterClause(request.getFilterModel(), dataParams));
        
        // Add sorting if specified
        String orderByClause = buildOrderByClause(request);
        if (!orderByClause.isEmpty()) {
            dataSql.append(" ").append(orderByClause);
        }
        
        // Add pagination
        dataSql.append(" OFFSET ? ROWS FETCH NEXT ? ROWS ONLY");
        
        dataParams.add(request.getStartRow());
        dataParams.add(Math.min(BATCH_SIZE, request.getEndRow() - request.getStartRow()));
        
        log.debug("Executing flat data query with {} filter values and {} filters", 
                filterValues.size(), request.getFilterModel() != null ? request.getFilterModel().size() : 0);
        
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(dataSql.toString(), dataParams.toArray());
        
        // Convert column names to lowercase for consistency
        List<Map<String, Object>> normalizedRows = normalizeColumnNames(rows);
        
        return SSRMResponseV4.builder()
            .rows(normalizedRows)
            .lastRow(totalCount != null ? totalCount : 0)
            .build();
    }
    
    private String buildOrderByClause(SSRMRequestV4 request) {
        if (request.getSortModel() == null || request.getSortModel().isEmpty()) {
            return "";
        }
        
        String orderBy = request.getSortModel().stream()
            .map(sort -> sort.getColId() + " " + sort.getSort().toUpperCase())
            .collect(Collectors.joining(", "));
        
        return "ORDER BY " + orderBy;
    }
    
    private String buildFilterClause(Map<String, Object> filterModel, List<Object> params) {
        if (filterModel == null || filterModel.isEmpty()) {
            return "";
        }
        
        List<String> filterClauses = new ArrayList<>();
        
        for (Map.Entry<String, Object> entry : filterModel.entrySet()) {
            String column = entry.getKey();
            Map<String, Object> filterDef = (Map<String, Object>) entry.getValue();
            
            if (filterDef != null && filterDef.get("filter") != null) {
                String filterValue = filterDef.get("filter").toString();
                String filterType = filterDef.getOrDefault("type", "contains").toString();
                
                switch (filterType.toLowerCase()) {
                    case "equals":
                        filterClauses.add(column + " = ?");
                        params.add(filterValue);
                        break;
                    case "notequal":
                        filterClauses.add(column + " != ?");
                        params.add(filterValue);
                        break;
                    case "contains":
                        filterClauses.add("UPPER(" + column + ") LIKE UPPER(?)");
                        params.add("%" + filterValue + "%");
                        break;
                    case "notcontains":
                        filterClauses.add("UPPER(" + column + ") NOT LIKE UPPER(?)");
                        params.add("%" + filterValue + "%");
                        break;
                    case "startswith":
                        filterClauses.add("UPPER(" + column + ") LIKE UPPER(?)");
                        params.add(filterValue + "%");
                        break;
                    case "endswith":
                        filterClauses.add("UPPER(" + column + ") LIKE UPPER(?)");
                        params.add("%" + filterValue);
                        break;
                    default:
                        // Default to contains
                        filterClauses.add("UPPER(" + column + ") LIKE UPPER(?)");
                        params.add("%" + filterValue + "%");
                        break;
                }
            }
        }
        
        return filterClauses.isEmpty() ? "" : " AND " + String.join(" AND ", filterClauses);
    }
    
    private List<Map<String, Object>> normalizeColumnNames(List<Map<String, Object>> rows) {
        return rows.stream()
            .map(row -> {
                Map<String, Object> normalizedRow = new HashMap<>();
                row.forEach((key, value) -> {
                    // Convert column names to lowercase and handle null values
                    String normalizedKey = key.toLowerCase();
                    normalizedRow.put(normalizedKey, value != null ? value : "");
                });
                return normalizedRow;
            })
            .collect(Collectors.toList());
    }
    
    private String buildSelectClause(List<String> visibleColumns, List<String> groupColumns) {
        if (visibleColumns == null || visibleColumns.isEmpty()) {
            return "*";  // Default to all columns if none specified
        }
        
        // Create a set of columns to select (removes duplicates)
        Set<String> columnsToSelect = new LinkedHashSet<>();
        
        // Add visible columns (excluding frontend-only columns)
        for (String col : visibleColumns) {
            if (!FRONTEND_ONLY_COLUMNS.contains(col)) {
                columnsToSelect.add(col);
            }
        }
        
        // Always include grouped columns (even if not in visible list)
        if (groupColumns != null) {
            for (String col : groupColumns) {
                if (!FRONTEND_ONLY_COLUMNS.contains(col)) {
                    columnsToSelect.add(col);
                }
            }
        }
        
        // If no valid columns, default to all
        if (columnsToSelect.isEmpty()) {
            return "*";
        }
        
        // Build the SELECT clause with DISTINCT
        return "DISTINCT " + String.join(", ", columnsToSelect);
    }
}