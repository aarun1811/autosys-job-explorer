package com.citi.gru.rectrace.service.v2;

import java.util.AbstractMap;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap; // Assuming it's in the parent service package
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import com.citi.gru.rectrace.dto.ElasticsearchProviderConfig;
import com.citi.gru.rectrace.dto.SearchCategoryDefinition;
import com.citi.gru.rectrace.dto.SearchCategoryResult;
import com.citi.gru.rectrace.service.SearchConfigService;

@Service
public class SearchServiceV2 {
    private static final Logger logger = LoggerFactory.getLogger(SearchServiceV2.class);

    private final SearchConfigService searchConfigService;
    private final ElasticsearchSearchProviderV2 elasticsearchSearchProviderV2;

    @Autowired
    public SearchServiceV2(SearchConfigService searchConfigService,
                           ElasticsearchSearchProviderV2 elasticsearchSearchProviderV2) {
        this.searchConfigService = searchConfigService;
        this.elasticsearchSearchProviderV2 = elasticsearchSearchProviderV2;
    }

    /**
     * Performs the V2 initial search asynchronously: essential, unique (collapsed) columns for all ES categories.
     */
    public Map<String, SearchCategoryResult> performInitialSearch(String userQuery) {
        return performInitialSearch(userQuery, true); // Default to collapsed mode
    }

    /**
     * Performs the V2 initial search asynchronously with collapse control.
     */
    public Map<String, SearchCategoryResult> performInitialSearch(String userQuery, boolean collapsed) {
        Map<String, SearchCategoryResult> finalResults = new LinkedHashMap<>();
        List<SearchCategoryDefinition> validCategories = searchConfigService.getValidSearchCategories();

        if (validCategories.isEmpty()) {
            logger.warn("V2 Initial Search: No valid search categories configured. Returning empty results.");
            return finalResults;
        }

        List<CompletableFuture<Map.Entry<String, SearchCategoryResult>>> futures = new ArrayList<>();

        for (SearchCategoryDefinition categoryConfig : validCategories) {
            if ("elasticsearch".equalsIgnoreCase(categoryConfig.getSearchProviderType())) {
                futures.add(asyncFetchInitialCategoryData(categoryConfig, userQuery, collapsed));
            }
            // Other provider types are skipped for V2 as per current scope
        }
    
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join(); // Wait for all async tasks
    
        for (CompletableFuture<Map.Entry<String, SearchCategoryResult>> future : futures) {
            try {
                Map.Entry<String, SearchCategoryResult> entry = future.get(); // Can throw InterruptedException or
                // ExecutionException
                if (entry != null && entry.getValue() != null && entry.getValue().getData() != null) {
                    finalResults.put(entry.getKey(), entry.getValue());
                }
            } catch (Exception e) { // Catch InterruptedException and ExecutionException
                logger.error("Error retrieving future result for V2 initial search category: {}", e.getMessage(), e);
            }
        }
    
        logger.info("V2 Initial Search completed for query '{}' (collapsed: {}). Found results for {} ES categories.", 
                userQuery, collapsed, finalResults.size());
        return finalResults;
    }
    
    @Async("taskExecutor") // Use the configured async executor from AsyncConfig
    public CompletableFuture<Map.Entry<String, SearchCategoryResult>> asyncFetchInitialCategoryData(SearchCategoryDefinition categoryConfig, String userQuery) {
        return asyncFetchInitialCategoryData(categoryConfig, userQuery, true); // Default to collapsed
    }

    @Async("taskExecutor") // Use the configured async executor from AsyncConfig
    public CompletableFuture<Map.Entry<String, SearchCategoryResult>> asyncFetchInitialCategoryData(SearchCategoryDefinition categoryConfig, String userQuery, boolean collapsed) {
        logger.debug("Async V2 Initial Fetch for category: {} (collapsed: {})", categoryConfig.getKey(), collapsed);
        List<String> essentialFields = Collections.emptyList();
        if (categoryConfig.getProviderConfig() instanceof ElasticsearchProviderConfig) {
            essentialFields = ((ElasticsearchProviderConfig) categoryConfig.getProviderConfig()).getResultFields();
        }
    
        if (CollectionUtils.isEmpty(essentialFields)) {
            logger.warn("Async V2 Initial Fetch for ES category {}: No resultFields defined. Cannot collapse or fetch" +
                    " efficiently.", categoryConfig.getKey());
            // Return null or an empty result entry to signify failure for this category
            return CompletableFuture.completedFuture(null);
        }
    
        try {
            SearchCategoryResult result = elasticsearchSearchProviderV2.performPaginatedSearch(
                    categoryConfig,
                    userQuery,
                    essentialFields,
                    collapsed
            );
            if (result != null) {
                return CompletableFuture.completedFuture(new AbstractMap.SimpleEntry<>(categoryConfig.getKey(),
                        result));
            }
        } catch (Exception e) {
            logger.error("Exception in asyncFetchInitialCategoryData for category {}: {}", categoryConfig.getKey(),
                    e.getMessage(), e);
        }
        return CompletableFuture.completedFuture(null); // Return null if search fails or no result
    }

    /**
     * Expands a specific group within a category to show all matching rows.
     */
    public Map<String, SearchCategoryResult> expandGroup(String userQuery, String categoryKey, String groupKey, List<String> visibleColumns) {
        logger.info("Expanding group '{}' for category '{}' with query '{}'", groupKey, categoryKey, userQuery);
        
        SearchCategoryDefinition categoryConfig = searchConfigService.getValidSearchCategories().stream()
                .filter(cat -> categoryKey.equals(cat.getKey()) && "elasticsearch".equalsIgnoreCase(cat.getSearchProviderType()))
                .findFirst()
                .orElse(null);

        if (categoryConfig == null) {
            logger.warn("Expand Group: Category key '{}' not found or not ES. Returning empty result.", categoryKey);
            return Collections.emptyMap();
        }

        try {
            SearchCategoryResult result = elasticsearchSearchProviderV2.expandGroup(
                    categoryConfig, 
                    groupKey, 
                    userQuery, 
                    visibleColumns != null ? visibleColumns : Collections.emptyList()
            );
            
            if (result != null) {
                return Collections.singletonMap(categoryKey, result);
            }
        } catch (Exception e) {
            logger.error("Exception in expandGroup for category {} and group {}: {}", categoryKey, groupKey, e.getMessage(), e);
        }
        
        return Collections.emptyMap();
    }


/**
 * Fetches detailed data (all rows, specified columns) for a single ES category using Scroll API.
 * This method is made async for consistency, though it only handles one category.
 * The controller will call this and expect the Map directly.
 */
public Map<String, SearchCategoryResult> fetchDetailedCategorySearch(String userQuery, String categoryKey,
                                                                     List<String> requestedDetailedFields) {
    CompletableFuture<Map.Entry<String, SearchCategoryResult>> futureResult =
            asyncFetchDetailedCategoryData(userQuery, categoryKey, requestedDetailedFields);
    try {
        Map.Entry<String, SearchCategoryResult> entry = futureResult.get(); // Wait for the async task to complete
        if (entry != null && entry.getValue() != null) {
            return Collections.singletonMap(entry.getKey(), entry.getValue());
        }
    } catch (Exception e) { // Catch InterruptedException and ExecutionException
        logger.error("Error retrieving future result for V2 detailed search for category {}: {}", categoryKey,
                e.getMessage(), e);
    }
    // Return empty map or a map with an empty result for the category in case of error
    SearchCategoryDefinition categoryConfig = searchConfigService.getValidSearchCategories().stream()
            .filter(cat -> categoryKey.equals(cat.getKey())).findFirst().orElse(null);
    if (categoryConfig != null && elasticsearchSearchProviderV2 != null) {
        return Collections.singletonMap(categoryKey, elasticsearchSearchProviderV2.buildResultDto(categoryConfig,
                Collections.emptyList()));
    }
    return Collections.emptyMap();
}

@Async("taskExecutor")
public CompletableFuture<Map.Entry<String, SearchCategoryResult>> asyncFetchDetailedCategoryData(String userQuery
        , String categoryKey, List<String> requestedDetailedFields) {
    logger.debug("Async V2 Detailed Fetch for category: {}", categoryKey);
    SearchCategoryDefinition categoryConfig = searchConfigService.getValidSearchCategories().stream()
            .filter(cat -> categoryKey.equals(cat.getKey()) && "elasticsearch".equalsIgnoreCase(cat.getSearchProviderType()))
            .findFirst()
            .orElse(null);

    if (categoryConfig == null) {
        logger.warn("Async V2 Detailed Search: Category key '{}' not found, not valid, or not ES. Returning null" +
                ".", categoryKey);
        return CompletableFuture.completedFuture(null);
    }
    if (CollectionUtils.isEmpty(requestedDetailedFields)) {
        logger.warn("Async V2 Detailed Search: No requestedDetailedFields for category '{}'. Returning null.",
                categoryKey);
        return CompletableFuture.completedFuture(null);
    }

        try {
            SearchCategoryResult result = elasticsearchSearchProviderV2.fetchAllResultsUsingScroll(
                    categoryConfig,
                    userQuery,
                    requestedDetailedFields
            );
            if (result != null) {
                return CompletableFuture.completedFuture(new AbstractMap.SimpleEntry<>(categoryKey, result));
            }
        } catch (Exception e) {
            logger.error("Exception in asyncFetchDetailedCategoryData for category {}: {}", categoryKey,
                    e.getMessage(), e);
        }
        return CompletableFuture.completedFuture(null);
    }
}
    