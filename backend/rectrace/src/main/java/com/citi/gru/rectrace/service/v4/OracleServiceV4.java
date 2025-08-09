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
        boolean isRootLevel = request.getGroupKeys() == null || request.getGroupKeys().isEmpty();
        
        try {
            if (isGrouped && isRootLevel) {
                // Fetch grouped data (one row per group)
                return fetchGroupedData(config, request);
            } else if (isGrouped && !isRootLevel) {
                // Fetch expanded group details
                return fetchExpandedGroupData(config, request);
            } else {
                // Fetch flat data (no grouping)
                return fetchFlatData(config, request);
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
        
        // Build SQL for grouped view
        String sql = String.format(
            "SELECT DISTINCT %s as group_value FROM %s WHERE %s IN (%s) ORDER BY %s OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
            groupColumn,
            config.getOracle().getTable(),
            config.getSearchColumn(),
            String.join(",", Collections.nCopies(filterValues.size(), "?")),
            groupColumn
        );
        
        // Build parameters
        List<Object> params = new ArrayList<>(filterValues);
        params.add(request.getStartRow());
        params.add(Math.min(BATCH_SIZE, request.getEndRow() - request.getStartRow()));
        
        log.debug("Executing grouped query with {} filter values", filterValues.size());
        
        // Execute query
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params.toArray());
        
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
        
        return SSRMResponseV4.builder()
            .rows(gridRows)
            .lastRow(filterValues.size())  // Total count is the number of unique values
            .build();
    }
    
    private SSRMResponseV4 fetchExpandedGroupData(CategoryConfigV4 config, SSRMRequestV4 request) {
        List<String> filterValues = request.getInitialFilter().getValues();
        String groupColumn = request.getRowGroupCols().get(0);
        String groupValue = request.getGroupKeys().get(0);
        
        // First get count for the expanded group
        List<Object> countParams = new ArrayList<>(filterValues);
        countParams.add(groupValue);
        
        String countSql = String.format(
            "SELECT COUNT(*) FROM %s WHERE %s IN (%s) AND %s = ?",
            config.getOracle().getTable(),
            config.getSearchColumn(),
            String.join(",", Collections.nCopies(filterValues.size(), "?")),
            groupColumn
        );
        
        // Add filter clauses to count query
        String filterClause = buildFilterClause(request.getFilterModel(), countParams);
        countSql += filterClause;
        
        Integer totalCount = jdbcTemplate.queryForObject(countSql, countParams.toArray(), Integer.class);
        
        // Build data query with sorting and pagination
        List<Object> dataParams = new ArrayList<>(filterValues);
        dataParams.add(groupValue);
        
        StringBuilder dataSql = new StringBuilder(String.format(
            "SELECT * FROM %s WHERE %s IN (%s) AND %s = ?",
            config.getOracle().getTable(),
            config.getSearchColumn(),
            String.join(",", Collections.nCopies(filterValues.size(), "?")),
            groupColumn
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
        
        log.debug("Executing expanded group query for group: {}", groupValue);
        
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
        
        // Prepare parameters for count query
        List<Object> countParams = new ArrayList<>(filterValues);
        
        // Get total count with filters
        String countSql = String.format(
            "SELECT COUNT(*) FROM %s WHERE %s IN (%s)",
            config.getOracle().getTable(),
            config.getSearchColumn(),
            String.join(",", Collections.nCopies(filterValues.size(), "?"))
        );
        
        // Add filter clauses to count query
        String filterClause = buildFilterClause(request.getFilterModel(), countParams);
        countSql += filterClause;
        
        Integer totalCount = jdbcTemplate.queryForObject(countSql, countParams.toArray(), Integer.class);
        
        // Build data query
        List<Object> dataParams = new ArrayList<>(filterValues);
        StringBuilder dataSql = new StringBuilder(String.format(
            "SELECT * FROM %s WHERE %s IN (%s)",
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
}