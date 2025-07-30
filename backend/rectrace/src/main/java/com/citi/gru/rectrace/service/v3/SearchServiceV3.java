package com.citi.gru.rectrace.service.v3;

import java.util.AbstractMap;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.citi.gru.rectrace.dto.SearchCategoryDefinition;
import com.citi.gru.rectrace.dto.SearchCategoryResult;
import com.citi.gru.rectrace.service.SearchConfigServiceV3;

@Service
public class SearchServiceV3 {
    private static final Logger logger = LoggerFactory.getLogger(SearchServiceV3.class);

    private final SearchConfigServiceV3 searchConfigServiceV3;
    private final ElasticsearchSearchProviderV3 elasticsearchSearchProviderV3;
    private final OracleSearchProviderV3 oracleSearchProviderV3;

    @Autowired
    public SearchServiceV3(SearchConfigServiceV3 searchConfigServiceV3,
                          ElasticsearchSearchProviderV3 elasticsearchSearchProviderV3,
                          OracleSearchProviderV3 oracleSearchProviderV3) {
        this.searchConfigServiceV3 = searchConfigServiceV3;
        this.elasticsearchSearchProviderV3 = elasticsearchSearchProviderV3;
        this.oracleSearchProviderV3 = oracleSearchProviderV3;
    }

    /**
     * Performs keyword search across all Elasticsearch categories asynchronously
     */
    public Map<String, SearchCategoryResult> performKeywordSearch(String query) {
        logger.info("V3 Keyword Search: Performing search across all categories for query: '{}'", query);
        
        Map<String, SearchCategoryResult> finalResults = new HashMap<>();
        List<SearchCategoryDefinition> validCategories = searchConfigServiceV3.getValidSearchCategories();

        if (validCategories.isEmpty()) {
            logger.warn("V3 Keyword Search: No valid search categories configured. Returning empty results.");
            return finalResults;
        }

        // Create async tasks for each Elasticsearch category
        List<CompletableFuture<Map.Entry<String, SearchCategoryResult>>> futures = new ArrayList<>();

        for (SearchCategoryDefinition categoryConfig : validCategories) {
            if ("elasticsearch".equalsIgnoreCase(categoryConfig.getSearchProviderType())) {
                futures.add(asyncFetchCategoryData(categoryConfig, query));
            }
        }

        // Wait for all async tasks to complete
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        // Collect results
        for (CompletableFuture<Map.Entry<String, SearchCategoryResult>> future : futures) {
            try {
                Map.Entry<String, SearchCategoryResult> entry = future.get();
                if (entry != null && entry.getValue() != null && entry.getValue().getData() != null) {
                    finalResults.put(entry.getKey(), entry.getValue());
                }
            } catch (Exception e) {
                logger.error("Error retrieving future result for V3 keyword search: {}", e.getMessage(), e);
            }
        }

        logger.info("V3 Keyword Search completed for query '{}'. Found results for {} categories.", 
                query, finalResults.size());
        return finalResults;
    }

    /**
     * Performs keyword search for a specific category
     */
    public Map<String, SearchCategoryResult> performKeywordSearch(String query, String category) {
        logger.info("V3 Keyword Search: Performing search for category '{}' with query: '{}'", category, query);
        
        SearchCategoryResult result = elasticsearchSearchProviderV3.performKeywordSearch(category, query);
        if (result != null && result.getData() != null && !result.getData().isEmpty()) {
            return Collections.singletonMap(category, result);
        }
        return Collections.emptyMap();
    }

    @Async("taskExecutor")
    public CompletableFuture<Map.Entry<String, SearchCategoryResult>> asyncFetchCategoryData(
            SearchCategoryDefinition categoryConfig, String query) {
        logger.debug("Async V3 Fetch for category: {}", categoryConfig.getKey());
        
        try {
            SearchCategoryResult result = elasticsearchSearchProviderV3.performKeywordSearch(categoryConfig.getKey(), query);
            if (result != null && result.getData() != null && !result.getData().isEmpty()) {
                return CompletableFuture.completedFuture(
                    new AbstractMap.SimpleEntry<>(categoryConfig.getKey(), result)
                );
            }
        } catch (Exception e) {
            logger.error("Error during async V3 fetch for category {}: {}", categoryConfig.getKey(), e.getMessage(), e);
        }
        
        return CompletableFuture.completedFuture(null);
    }

    /**
     * Perform SSRM data fetch for a specific category
     * This method handles both initial data load and group expansion
     * @param category The category to fetch data for
     * @param searchTerm The search term
     * @param groupKeys Optional group keys for expansion
     * @param visibleColumns Optional list of visible columns
     * @return SSRM formatted response
     */
    public Map<String, Object> getSSRMDataForCategory(String category, String searchTerm, 
                                                     List<String> groupKeys, List<String> visibleColumns) {
        try {
            // Handle group expansion
            if (groupKeys != null && !groupKeys.isEmpty()) {
                String groupKey = groupKeys.get(groupKeys.size() - 1); // Get the last group key
                SearchCategoryResult result = oracleSearchProviderV3.expandGroup(category, groupKey, searchTerm, visibleColumns);
                
                if (result != null && result.getData() != null) {
                    return new HashMap<String, Object>() {{
                        put("success", true);
                        put("rows", result.getData());
                        put("lastRow", result.getData().size());
                    }};
                }
            } else {
                // Initial data load for category - use Elasticsearch
                Map<String, SearchCategoryResult> searchResults = performKeywordSearch(searchTerm, category);
                
                if (searchResults != null && searchResults.containsKey(category)) {
                    SearchCategoryResult result = searchResults.get(category);
                    if (result != null && result.getData() != null) {
                        // Filter data by visible columns if specified
                        List<Map<String, Object>> filteredData = filterDataByVisibleColumns(result.getData(), visibleColumns);
                        return new HashMap<String, Object>() {{
                            put("success", true);
                            put("rows", filteredData);
                            put("lastRow", filteredData.size());
                        }};
                    }
                }
            }
            
            // Return empty result
            return new HashMap<String, Object>() {{
                put("success", true);
                put("rows", Collections.emptyList());
                put("lastRow", 0);
            }};
            
        } catch (Exception e) {
            logger.error("Error in SSRM request for category: {}", category, e);
            return new HashMap<String, Object>() {{
                put("success", false);
                put("error", e.getMessage());
                put("rows", Collections.emptyList());
                put("lastRow", 0);
            }};
        }
    }

    /**
     * Filter data by visible columns
     */
    private List<Map<String, Object>> filterDataByVisibleColumns(List<Map<String, Object>> data, List<String> visibleColumns) {
        if (visibleColumns == null || visibleColumns.isEmpty()) {
            return data;
        }
        
        return data.stream()
                .map(row -> {
                    Map<String, Object> filteredRow = new HashMap<>();
                    for (String column : visibleColumns) {
                        if (row.containsKey(column)) {
                            filteredRow.put(column, row.get(column));
                        }
                    }
                    return filteredRow;
                })
                .collect(java.util.stream.Collectors.toList());
    }
} 