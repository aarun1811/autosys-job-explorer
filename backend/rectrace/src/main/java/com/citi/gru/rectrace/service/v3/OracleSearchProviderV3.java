package com.citi.gru.rectrace.service.v3;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.citi.gru.rectrace.dto.OracleProviderConfig;
import com.citi.gru.rectrace.dto.SearchCategoryConfig;
import com.citi.gru.rectrace.dto.SearchCategoryDefinition;
import com.citi.gru.rectrace.dto.SearchCategoryResult;
import com.citi.gru.rectrace.service.SearchConfigServiceV3;

@Service
public class OracleSearchProviderV3 {

    private static final Logger logger = LoggerFactory.getLogger(OracleSearchProviderV3.class);
    private static final int MAX_RESULTS = 10000; // Reasonable limit for group expansion

    private final DataSource dataSource;
    private final SearchConfigServiceV3 searchConfigServiceV3;

    @Autowired
    public OracleSearchProviderV3(DataSource dataSource, SearchConfigServiceV3 searchConfigServiceV3) {
        this.dataSource = dataSource;
        this.searchConfigServiceV3 = searchConfigServiceV3;
    }

    /**
     * Expand a group with detailed data from Oracle
     * @param category The search category
     * @param groupKey The group key to expand
     * @param searchTerm The search term for filtering
     * @param visibleColumns Optional list of visible columns to fetch
     * @return SearchCategoryResult with expanded data
     */
    public SearchCategoryResult expandGroup(String category, String groupKey, String searchTerm, List<String> visibleColumns) {
        try {
            SearchCategoryDefinition categoryDefinition = searchConfigServiceV3.getCategoryDefinition(category);
            if (categoryDefinition == null || categoryDefinition.getOracleConfig() == null) {
                logger.error("Oracle configuration not found for category: {}", category);
                return null;
            }

            OracleProviderConfig oracleConfig = categoryDefinition.getOracleConfig();
            String query = oracleConfig.getQuery();
            
            if (query == null || query.trim().isEmpty()) {
                logger.error("Oracle query not configured for category: {}", category);
                return null;
            }

            // Build the optimized query with visible columns (always DISTINCT)
            String finalQuery = buildOptimizedQuery(query, visibleColumns, oracleConfig);
            
            logger.info("Oracle V3 Group Expansion - Category: {}, GroupKey: {}, Query: {}", 
                    category, groupKey, finalQuery);

            try (Connection connection = dataSource.getConnection();
                 PreparedStatement statement = connection.prepareStatement(finalQuery)) {
                
                // Set parameters
                setQueryParameters(statement, oracleConfig, groupKey, searchTerm);
                
                try (ResultSet resultSet = statement.executeQuery()) {
                    List<Map<String, Object>> data = extractDataFromResultSet(resultSet, visibleColumns);
                    
                    SearchCategoryConfig config = new SearchCategoryConfig();
                    config.setKey(category);
                    config.setLabel(categoryDefinition.getLabel());
                    
                    return new SearchCategoryResult(config, data);
                }
            }
        } catch (Exception e) {
            logger.error("Error expanding group for category: {} with groupKey: {}", category, groupKey, e);
        }
        return null;
    }

    /**
     * Fetch flat data from Oracle (no grouping)
     * Used when row groups are removed and we need flat data structure
     * @param category The search category
     * @param searchTerm The search term for filtering
     * @param visibleColumns Optional list of visible columns to fetch
     * @return SearchCategoryResult with flat data
     */
    public SearchCategoryResult fetchFlatData(String category, String searchTerm, 
                                            List<String> visibleColumns) {
        try {
            SearchCategoryDefinition categoryDefinition = searchConfigServiceV3.getCategoryDefinition(category);
            if (categoryDefinition == null || categoryDefinition.getOracleConfig() == null) {
                logger.error("Oracle configuration not found for category: {}", category);
                return null;
            }

            OracleProviderConfig oracleConfig = categoryDefinition.getOracleConfig();
            
            // Build an optimized flat query (always DISTINCT)
            String flatQuery = buildOptimizedFlatQuery(visibleColumns, oracleConfig, searchTerm);
            
            logger.info("Oracle V3 Flat Data - Category: {}, Query: {}", category, flatQuery);

            try (Connection connection = dataSource.getConnection();
                 PreparedStatement statement = connection.prepareStatement(flatQuery)) {
                
                // Set search term parameter if needed
                if (StringUtils.hasText(searchTerm)) {
                    statement.setString(1, "%" + searchTerm + "%");
                    statement.setString(2, "%" + searchTerm + "%");
                    statement.setString(3, "%" + searchTerm + "%");
                }
                
                try (ResultSet resultSet = statement.executeQuery()) {
                    List<Map<String, Object>> data = extractDataFromResultSet(resultSet, visibleColumns);
                    
                    SearchCategoryConfig config = new SearchCategoryConfig();
                    config.setKey(category);
                    config.setLabel(categoryDefinition.getLabel());
                    
                    return new SearchCategoryResult(config, data);
                }
            }
        } catch (Exception e) {
            logger.error("Error fetching flat data for category: {}", category, e);
        }
        return null;
    }

    /**
     * Build optimized query with column filtering (always DISTINCT)
     */
    private String buildOptimizedQuery(String baseQuery, List<String> visibleColumns, 
                                     OracleProviderConfig oracleConfig) {
        // Always use DISTINCT for Oracle queries to ensure unique records
        String selectClause = "SELECT DISTINCT ";
        
        if (visibleColumns == null || visibleColumns.isEmpty()) {
            // Use all configured result fields
            String[] resultFields = oracleConfig.getResultFields();
            if (resultFields != null && resultFields.length > 0) {
                selectClause += String.join(", ", resultFields);
            } else {
                selectClause += "*";
            }
        } else {
            // Use only visible columns
            selectClause += String.join(", ", visibleColumns);
        }
        
        // Replace the SELECT clause in the base query
        return baseQuery.replaceFirst("SELECT\\s+\\*", selectClause);
    }

    /**
     * Build optimized flat data query (always DISTINCT)
     */
    private String buildOptimizedFlatQuery(List<String> visibleColumns, OracleProviderConfig oracleConfig, 
                                         String searchTerm) {
        String baseTable = "autosys_jobs"; // This should come from config
        
        // Always use DISTINCT for Oracle queries to ensure unique records
        String selectClause = "SELECT DISTINCT ";
        
        if (visibleColumns == null || visibleColumns.isEmpty()) {
            // Use all configured result fields
            String[] resultFields = oracleConfig.getResultFields();
            if (resultFields != null && resultFields.length > 0) {
                selectClause += String.join(", ", resultFields);
            } else {
                selectClause += "*";
            }
        } else {
            // Use only visible columns
            selectClause += String.join(", ", visibleColumns);
        }
        
        String whereClause = "";
        if (StringUtils.hasText(searchTerm)) {
            whereClause = " WHERE (recon LIKE ? OR load_job LIKE ? OR box_name LIKE ?)";
        }
        
        return selectClause + " FROM " + baseTable + whereClause + " FETCH FIRST " + MAX_RESULTS + " ROWS ONLY";
    }

    /**
     * Extracts data from ResultSet into a list of maps
     */
    private List<Map<String, Object>> extractDataFromResultSet(ResultSet rs) throws SQLException {
        List<Map<String, Object>> data = new ArrayList<>();
        
        while (rs.next()) {
            Map<String, Object> row = new HashMap<>();
            
            // Get all available columns
            int columnCount = rs.getMetaData().getColumnCount();
            for (int i = 1; i <= columnCount; i++) {
                String columnName = rs.getMetaData().getColumnName(i);
                Object value = rs.getObject(i);
                row.put(columnName, value);
            }
            
            data.add(row);
        }
        
        return data;
    }

    /**
     * Extracts data from ResultSet into a list of maps, considering visible columns
     */
    private List<Map<String, Object>> extractDataFromResultSet(ResultSet rs, List<String> visibleColumns) throws SQLException {
        List<Map<String, Object>> data = new ArrayList<>();
        
        while (rs.next()) {
            Map<String, Object> row = new HashMap<>();
            
            // Get only visible columns
            for (String column : visibleColumns) {
                Object value = rs.getObject(column);
                row.put(column, value);
            }
            
            data.add(row);
        }
        
        return data;
    }

    /**
     * Sets parameters for the prepared statement
     */
    private void setQueryParameters(PreparedStatement stmt, OracleProviderConfig oracleConfig, String groupKey, String searchTerm) throws SQLException {
        int paramIndex = 1;
        
        // Set the group key parameter
        if (oracleConfig.getParameters() != null && oracleConfig.getParameters().containsKey("groupKey")) {
            stmt.setString(paramIndex++, groupKey);
        } else {
            // Fallback to legacy parameterName
            stmt.setString(paramIndex++, groupKey);
        }
        
        // Set the search term parameter if needed
        if (StringUtils.hasText(searchTerm) && oracleConfig.getQuery().contains(":searchTerm")) {
            stmt.setString(paramIndex++, "%" + searchTerm + "%");
        }
    }

    /**
     * Build result DTO from extracted data
     */
    private SearchCategoryResult buildResultDto(SearchCategoryDefinition categoryDefinition, List<Map<String, Object>> data) {
        // Create SearchCategoryConfig from category definition
        SearchCategoryConfig config = new SearchCategoryConfig();
        config.setKey(categoryDefinition.getKey());
        config.setLabel(categoryDefinition.getLabel());
        config.setColumns(categoryDefinition.getColumns());
        
        // Create result using the correct constructor
        SearchCategoryResult result = new SearchCategoryResult(config, data);
        return result;
    }
} 