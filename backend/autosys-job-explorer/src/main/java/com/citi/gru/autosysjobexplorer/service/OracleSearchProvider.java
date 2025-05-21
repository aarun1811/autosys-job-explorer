package com.citi.gru.autosysjobexplorer.service;

import com.citi.gru.autosysjobexplorer.dto.*; // Import all relevant DTOs
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.persistence.PersistenceException;
import javax.persistence.Query;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class OracleSearchProvider implements SearchProvider {

    private static final Logger logger = LoggerFactory.getLogger(OracleSearchProvider.class);

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public String getProviderType() {
        return "oracle"; // This provider handles 'oracle' type configurations
    }

    @Override
    @Transactional(readOnly = true)
    public SearchCategoryResult search(SearchCategoryDefinition categoryDefinition, String searchTerm) {
        logger.info("Attempting Oracle search for category key: {}, search term: '{}'", categoryDefinition.getKey(), 
                searchTerm);

        // 1. Get and validate the Oracle-specific configuration
        ProviderSpecificConfig genericProviderConfig = categoryDefinition.getProviderConfig();
        if (!(genericProviderConfig instanceof OracleProviderConfig oracleConfig)) {
            logger.error("Invalid configuration for Oracle search provider. Category key: {}. Expected" + 
                    "OracleProviderConfig but got {}",
                    categoryDefinition.getKey(), genericProviderConfig != null ? 
                    genericProviderConfig.getClass().getName() : "null");
            return null; // Cannot proceed without correct config type
        }

        String sql = oracleConfig.getQuery();
        String parameterName = oracleConfig.getParameterName();

        // 2. Validate required config fields for Oracle
        if (!StringUtils.hasText(sql)) {
            logger.warn("Oracle search skipped for category '{}': Missing 'query' in oracleConfig.", 
            categoryDefinition.getKey());
            return null;
        }
        if (!StringUtils.hasText(parameterName)) {
            logger.warn("Oracle search skipped for category '{}': Missing 'parameterName' in oracleConfig.", categoryDefinition.getKey());
            return null;
        }
        if (CollectionUtils.isEmpty(categoryDefinition.getColumns())) {
             logger.warn("Oracle search skipped for category '{}': Missing 'columns' definition.", categoryDefinition.getKey());
             return null;
        }

        // 3. Prepare search pattern (using existing logic)
        String pattern = unixToSqlLike(searchTerm);

        // 4. Execute the query using the helper method
        List<Map<String, Object>> data = runNativeQuery(sql, parameterName, pattern, categoryDefinition.getColumns(), categoryDefinition.getKey());

        // 5. Construct the result DTO if data retrieval was successful
        if (data != null) { // runNativeQuery returns null on persistence error
            // Create the minimal SearchCategoryConfig DTO for the response
            SearchCategoryConfig minimalConfigDto = new SearchCategoryConfig();
            minimalConfigDto.setKey(categoryDefinition.getKey());
            minimalConfigDto.setLabel(categoryDefinition.getLabel());
            minimalConfigDto.setColumns(categoryDefinition.getColumns());

            logger.info("Oracle search succeeded for category '{}', found {} results.", categoryDefinition.getKey(), data.size());
            return new SearchCategoryResult(minimalConfigDto, data);
        } else {
            // Error already logged in runNativeQuery
            logger.error("Oracle search failed for category '{}'.", categoryDefinition.getKey());
            return null; // Indicate failure
        }
    }

    /**
     * Converts user input with Unix-style wildcards (?, *) to SQL LIKE patterns (%, _).
     * (Copied from EnhancedSearchService)
     */
    private static String unixToSqlLike(String userInput) {
         if (userInput == null || userInput.trim().isEmpty()) {
            return "%"; // Return wildcard if input is empty or null
        }
        String pattern = userInput.trim()
                            .replace("?", "_").replace("*", "%");
        // Ensure pattern starts and ends with wildcard, avoiding duplicates
        if (!pattern.startsWith("%")) {
            pattern = "%" + pattern;
        }
        if (!pattern.endsWith("%")) {
            pattern = pattern + "%";
        }
        return pattern.replace("%%", "%"); // Avoid double wildcards
    }

    /**
     * Runs a native SQL query and maps the results based on the provided column definitions.
     * (Adapted from EnhancedSearchService runNativeQuery)
     *
     * @param sql The native SQL query string.
     * @param parameterName The name of the single parameter in the query.
     * @param parameterValue The value for the parameter (already formatted with wildcards).
     * @param columns The list of SearchColumnDefinition defining expected columns and their mapping.
     * @param categoryKey For logging purposes.
     * @return A list of maps representing the rows, or null if a persistence error occurs.
     */
    private List<Map<String, Object>> runNativeQuery(String sql, String parameterName, Object parameterValue, List<SearchColumnDefinition> columns, String categoryKey) {
        logger.debug("Executing SQL for category '{}': {}", categoryKey, sql.substring(0, Math.min(sql.length(), 100)).replace('\n', ' ') + "...");
        logger.debug("Binding parameter :{} with value: {}", parameterName, parameterValue);

        Query query = entityManager.createNativeQuery(sql);

        // Bind the single parameter
        try {
            query.setParameter(parameterName, parameterValue);
        } catch (IllegalArgumentException ex) {
            logger.error("Failed to bind parameter '{}' for category '{}'. Check if parameter exists in SQL and config. Error: {}",
                    parameterName, categoryKey, ex.getMessage());
            return null; // Indicate error
        }

        try {
            // Get raw results
            @SuppressWarnings("unchecked") List<Object[]> rows = query.getResultList();
            logger.debug("Query for category '{}' returned {} rows.", categoryKey, rows.size());

            // Extract expected field names from column definitions
            List<String> expectedFields = columns.stream()
                                                 .map(SearchColumnDefinition::getField)
                                                 .collect(Collectors.toList());

            // Transform rows to maps
            List<Map<String, Object>> results = new ArrayList<>();
            for (Object[] row : rows) {
                Map<String, Object> map = new LinkedHashMap<>();
                if (row.length != expectedFields.size()) {
                     logger.warn("Category '{}': Mismatch between number of fields returned by query ({}) and expected fields defined in config ({}). Row data: {}",
                             categoryKey, row.length, expectedFields.size(), Arrays.toString(row));
                     // Attempt to map based on available data, potential for errors or missing data
                }

                for (int i = 0; i < expectedFields.size(); i++) {
                    String fieldName = expectedFields.get(i);
                    if (i < row.length) {
                        map.put(fieldName, row[i]);
                    } else {
                        map.put(fieldName, null); // Put null if query returned fewer columns than expected
                    }
                }
                results.add(map);
            }
            return results;
        } catch (PersistenceException e) {
            logger.error("Error executing native query for category '{}': {}", categoryKey, e.getMessage(), e);
            return null; // Indicate error
        } catch (Exception e) {
             logger.error("Unexpected error processing query results for category '{}': {}", categoryKey, e.getMessage(), e);
             return null; // Indicate error
        }
    }
}