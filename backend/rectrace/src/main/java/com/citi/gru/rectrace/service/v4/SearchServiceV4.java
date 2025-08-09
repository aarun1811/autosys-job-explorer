package com.citi.gru.rectrace.service.v4;

import com.citi.gru.rectrace.dto.v4.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@Service
@Slf4j
public class SearchServiceV4 {
    
    @Autowired
    private ElasticsearchServiceV4 esService;
    
    @Autowired
    private OracleServiceV4 oracleService;
    
    @Autowired
    private SearchConfigServiceV4 configService;
    
    public InitialSearchResponseV4 performInitialSearch(String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            log.warn("Empty search keyword provided");
            return InitialSearchResponseV4.builder()
                    .categoryResults(new HashMap<>())
                    .searchTerm(keyword)
                    .timestamp(System.currentTimeMillis())
                    .build();
        }
        
        log.info("Performing initial search for keyword: {}", keyword);
        
        Map<String, CategoryResultV4> categoryResults = new HashMap<>();
        List<CompletableFuture<Void>> futures = new ArrayList<>();
        
        // Search all categories in parallel
        for (CategoryConfigV4 category : configService.getCategories()) {
            CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                try {
                    // Get unique values from Elasticsearch
                    List<String> uniqueValues = esService.getUniqueValues(keyword, category);
                    
                    // Build category result
                    CategoryResultV4 result = CategoryResultV4.builder()
                            .key(category.getKey())
                            .label(category.getLabel())
                            .values(uniqueValues)
                            .count(uniqueValues.size())
                            .hasMore(uniqueValues.size() >= 1000)  // Hit the limit
                            .columns(category.getColumns())
                            .build();
                    
                    categoryResults.put(category.getKey(), result);
                    
                    log.debug("Category {} returned {} results", category.getKey(), uniqueValues.size());
                    
                } catch (Exception e) {
                    log.error("Error searching category: " + category.getKey(), e);
                    // Add empty result for failed category
                    CategoryResultV4 emptyResult = CategoryResultV4.builder()
                            .key(category.getKey())
                            .label(category.getLabel())
                            .values(new ArrayList<>())
                            .count(0)
                            .hasMore(false)
                            .columns(category.getColumns())
                            .build();
                    categoryResults.put(category.getKey(), emptyResult);
                }
            });
            futures.add(future);
        }
        
        // Wait for all searches to complete
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        
        log.info("Initial search completed. Categories with results: {}", 
                categoryResults.values().stream()
                        .filter(c -> c.getCount() > 0)
                        .map(CategoryResultV4::getKey)
                        .collect(Collectors.toList()));
        
        return InitialSearchResponseV4.builder()
                .categoryResults(categoryResults)
                .searchTerm(keyword)
                .timestamp(System.currentTimeMillis())
                .build();
    }
    
    public SSRMResponseV4 fetchSSRMData(String categoryKey, SSRMRequestV4 request) {
        // Validate category
        if (!configService.isValidCategory(categoryKey)) {
            log.error("Invalid category: {}", categoryKey);
            return SSRMResponseV4.builder()
                    .rows(new ArrayList<>())
                    .lastRow(0)
                    .build();
        }
        
        CategoryConfigV4 config = configService.getCategoryConfig(categoryKey);
        
        log.debug("Fetching SSRM data for category: {}, startRow: {}, endRow: {}", 
                categoryKey, request.getStartRow(), request.getEndRow());
        
        // Delegate to Oracle service
        return oracleService.fetchSSRMData(config, request);
    }
    
    public SearchConfigurationV4 getConfiguration() {
        return configService.getConfiguration();
    }
    
    @Async
    public CompletableFuture<CategoryResultV4> searchCategoryAsync(String keyword, CategoryConfigV4 category) {
        try {
            List<String> uniqueValues = esService.getUniqueValues(keyword, category);
            
            CategoryResultV4 result = CategoryResultV4.builder()
                    .key(category.getKey())
                    .label(category.getLabel())
                    .values(uniqueValues)
                    .count(uniqueValues.size())
                    .hasMore(uniqueValues.size() >= 1000)
                    .columns(category.getColumns())
                    .build();
            
            return CompletableFuture.completedFuture(result);
            
        } catch (Exception e) {
            log.error("Error in async search for category: " + category.getKey(), e);
            CategoryResultV4 emptyResult = CategoryResultV4.builder()
                    .key(category.getKey())
                    .label(category.getLabel())
                    .values(new ArrayList<>())
                    .count(0)
                    .hasMore(false)
                    .columns(category.getColumns())
                    .build();
            return CompletableFuture.completedFuture(emptyResult);
        }
    }
}