package com.citi.gru.rectrace.service.v4;

import com.citi.gru.rectrace.dto.v4.CategoryConfigV4;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.collapse.CollapseBuilder;
import org.elasticsearch.search.sort.SortOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Slf4j
public class ElasticsearchServiceV4 {
    
    @Autowired(required = false)
    private RestHighLevelClient esClient;
    
    public List<String> getUniqueValues(String keyword, CategoryConfigV4 config) {
        if (esClient == null) {
            log.warn("Elasticsearch client not configured, returning empty results");
            return new ArrayList<>();
        }
        
        try {
            SearchRequest searchRequest = new SearchRequest(config.getElasticsearch().getIndex());
            SearchSourceBuilder sourceBuilder = new SearchSourceBuilder();
            
            // Build wildcard query for all search fields
            BoolQueryBuilder query = QueryBuilders.boolQuery();
            String searchPattern = "*" + keyword.toLowerCase() + "*";
            
            for (String field : config.getElasticsearch().getSearchFields()) {
                query.should(QueryBuilders.wildcardQuery(field, searchPattern));
            }
            
            // Configure collapse to get unique values
            CollapseBuilder collapse = new CollapseBuilder(config.getElasticsearch().getCollapseField());
            
            // Set up the search
            sourceBuilder.query(query)
                    .collapse(collapse)
                    .size(config.getElasticsearch().getMaxResults())  // Max 1000
                    .fetchSource(new String[]{config.getSearchColumn()}, null)
                    .sort(config.getElasticsearch().getCollapseField(), SortOrder.ASC);
            
            searchRequest.source(sourceBuilder);
            
            log.debug("Executing ES query for category: {}, keyword: {}", config.getKey(), keyword);
            SearchResponse response = esClient.search(searchRequest, RequestOptions.DEFAULT);
            
            List<String> results = Arrays.stream(response.getHits().getHits())
                    .map(this::extractValue)
                    .filter(value -> value != null && !value.isEmpty())
                    .collect(Collectors.toList());
            
            log.info("ES search for category {} returned {} unique values", config.getKey(), results.size());
            return results;
            
        } catch (Exception e) {
            log.error("Elasticsearch query failed for category: " + config.getKey(), e);
            return new ArrayList<>();
        }
    }
    
    private String extractValue(SearchHit hit) {
        try {
            Map<String, Object> sourceMap = hit.getSourceAsMap();
            if (sourceMap == null || sourceMap.isEmpty()) {
                return null;
            }
            
            // Get the first non-null value from the source
            Object value = sourceMap.values().stream()
                    .filter(v -> v != null)
                    .findFirst()
                    .orElse(null);
            
            return value != null ? value.toString() : null;
        } catch (Exception e) {
            log.warn("Failed to extract value from ES hit", e);
            return null;
        }
    }
}