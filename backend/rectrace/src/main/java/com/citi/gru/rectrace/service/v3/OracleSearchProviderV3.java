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
     * Fetch detailed data for a specific group
     * This is the simplified version that only handles group expansion
     */
    public SearchCategoryResult expandGroup(String categoryKey, String groupKey, String searchTerm) {
        logger.info("Oracle V3 Expand Group: Category: {}, Group: '{}', Term: '{}'", 
                categoryKey, groupKey, searchTerm);

        // Get Oracle configuration for the category
        OracleProviderConfig oracleConfig = searchConfigServiceV3.getGroupExpansionConfig(categoryKey);
        if (oracleConfig == null) {
            logger.warn("Oracle V3 Expand Group: No valid Oracle config found for category '{}'", categoryKey);
            return null;
        }

        // Get category definition for building result
        SearchCategoryDefinition categoryDefinition = searchConfigServiceV3.getCategoryDefinition(categoryKey);
        if (categoryDefinition == null) {
            logger.warn("Oracle V3 Expand Group: No category definition found for '{}'", categoryKey);
            return null;
        }

        try (Connection connection = dataSource.getConnection()) {
            // Build the query for group expansion
            String query = buildGroupExpansionQuery(oracleConfig, groupKey);
            
            logger.debug("Executing Oracle V3 Group Expansion for category {} group {}: Query: {}", 
                    categoryKey, groupKey, query);

            try (PreparedStatement stmt = connection.prepareStatement(query)) {
                // Set the group key parameter
                stmt.setString(1, groupKey);
                
                // Set the search term parameter if needed
                if (StringUtils.hasText(searchTerm) && oracleConfig.getQuery().contains(":searchTerm")) {
                    stmt.setString(2, "%" + searchTerm + "%");
                }

                try (ResultSet rs = stmt.executeQuery()) {
                    List<Map<String, Object>> data = extractDataFromResultSet(rs);
                    
                    logger.info("Oracle V3 Expand Group for category {} group {}: Returned {} rows.",
                            categoryKey, groupKey, data.size());
                    
                    return buildResultDto(categoryDefinition, data);
                }
            }
        } catch (SQLException e) {
            logger.error("Error during Oracle V3 Expand Group for category {} group {}: {}", 
                    categoryKey, groupKey, e.getMessage(), e);
            return null;
        }
    }

    /**
     * Builds the SQL query for group expansion
     */
    private String buildGroupExpansionQuery(OracleProviderConfig oracleConfig, String groupKey) {
        // Use the configured query from the Oracle config
        String baseQuery = oracleConfig.getQuery();
        
        // If the query contains :groupKey placeholder, replace it
        if (baseQuery.contains(":groupKey")) {
            baseQuery = baseQuery.replace(":groupKey", "?");
        }
        
        // If the query contains :searchTerm placeholder, replace it
        if (baseQuery.contains(":searchTerm")) {
            baseQuery = baseQuery.replace(":searchTerm", "?");
        }
        
        // Add limit if not present
        if (!baseQuery.toLowerCase().contains("fetch first") && !baseQuery.toLowerCase().contains("rownum")) {
            baseQuery += " FETCH FIRST " + MAX_RESULTS + " ROWS ONLY";
        }
        
        return baseQuery;
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