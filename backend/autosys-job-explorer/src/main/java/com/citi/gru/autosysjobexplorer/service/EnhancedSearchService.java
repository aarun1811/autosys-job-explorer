package com.citi.gru.autosysjobexplorer.service;

import java.util.AbstractMap;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;
import java.util.stream.Collectors; // Import StringUtils

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.citi.gru.autosysjobexplorer.dto.SearchCategoryDefinition;
import com.citi.gru.autosysjobexplorer.dto.SearchCategoryResult;

@Service
public class EnhancedSearchService {
    private static final Logger logger = LoggerFactory.getLogger(EnhancedSearchService.class);

    private final SearchConfigService searchConfigService;
    private final Map<String, SearchProvider> searchProviders; // Map to hold providers by type

    @Autowired
    public EnhancedSearchService(SearchConfigService searchConfigService, List<SearchProvider> providers) {
        this.searchConfigService = searchConfigService;
        // Create a map of providers keyed by their type ("oracle", "elasticsearch") for easy lookup
        this.searchProviders = providers.stream()
                .collect(Collectors.toMap(
                        provider -> provider.getProviderType().toLowerCase(), // Use lowercase keys
                        Function.identity()
                ));
        logger.info("Initialized EnhancedSearchService with providers: {}", this.searchProviders.keySet());
    }

    /**
     * Performs searches across all valid configured categories asynchronously, delegating to the appropriate provider.
     *
     * @param userQuery The raw query string from the user.
     * @return A map where keys are category keys and values are SearchCategoryResult objects.
     */
    public Map<String, SearchCategoryResult> search(String userQuery) {
        Map<String, SearchCategoryResult> finalResults = new LinkedHashMap<>(); // Keep insertion order
        List<SearchCategoryDefinition> validCategories = searchConfigService.getValidSearchCategories();

        if (validCategories.isEmpty()) {
            logger.warn("No valid search categories configured or loaded. Returning empty results.");
            return finalResults;
        }

        List<CompletableFuture<Map.Entry<String, SearchCategoryResult>>> futures = new ArrayList<>();

        for (SearchCategoryDefinition categoryConfig : validCategories) {
            // Delegate the execution to the async method which finds the correct provider
            futures.add(asyncDelegateSearch(categoryConfig, userQuery));
        }

        // Wait for all async tasks to complete
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        // Collect results, skipping categories that failed or returned null
        for (CompletableFuture<Map.Entry<String, SearchCategoryResult>> future : futures) {
            try {
                Map.Entry<String, SearchCategoryResult> entry = future.get();
                if (entry != null && entry.getValue() != null) {
                    // Only add if the provider returned a valid result
                    finalResults.put(entry.getKey(), entry.getValue());
                }
            } catch (Exception e) {
                logger.error("Unexpected error retrieving delegated search results for a category: {}", e.getMessage(), e);
            }
        }

        logger.info("Search completed for query '{}', found results for {} categories.", userQuery, finalResults.size());
        return finalResults;
    }

    /**
     * Asynchronously delegates the search for a single category to the appropriate SearchProvider.
     *
     * @param categoryDefinition The full configuration for the search category.
     * @param userInput The raw query string from the user.
     * @return A CompletableFuture containing a Map Entry with the category key and its SearchCategoryResult,
     * or null if no provider is found or an error occurs during delegation or execution.
     */
    @Async("taskExecutor") // Use the configured async executor
    public CompletableFuture<Map.Entry<String, SearchCategoryResult>> asyncDelegateSearch(SearchCategoryDefinition categoryDefinition, String userInput) {
        String providerType = categoryDefinition.getSearchProviderType();

        // Validate provider type early
        if (!StringUtils.hasText(providerType)) {
            logger.warn("Category '{}' is missing 'searchProviderType'. Skipping search.", categoryDefinition.getKey());
            return CompletableFuture.completedFuture(null);
        }

        // Find the appropriate provider from the map
        SearchProvider provider = searchProviders.get(providerType.toLowerCase());

        if (provider == null) {
            logger.warn("No SearchProvider bean found for type '{}' defined in category '{}'. Skipping search.", providerType, categoryDefinition.getKey());
            return CompletableFuture.completedFuture(null);
        }

        logger.debug("Delegating search for category '{}' to provider type '{}'", categoryDefinition.getKey(), providerType);

        try {
            // Call the specific provider's search method
            SearchCategoryResult result = provider.search(categoryDefinition, userInput);

            if (result != null) {
                // Provider succeeded and returned a result (even if data list is empty)
                return CompletableFuture.completedFuture(new AbstractMap.SimpleEntry<>(categoryDefinition.getKey(), result));
            } else {
                // Provider indicated failure (e.g., config error, execution error) by returning null
                logger.warn("Provider '{}' returned null for category '{}'. Skipping result.", providerType, categoryDefinition.getKey());
                return CompletableFuture.completedFuture(null);
            }
        } catch (Exception e) {
            // Catch unexpected errors during provider execution
            logger.error("Async search delegation failed for category '{}' using provider '{}': {}",
                    categoryDefinition.getKey(), providerType, e.getMessage(), e);
            return CompletableFuture.completedFuture(null); // Indicate failure
        }
    }
}