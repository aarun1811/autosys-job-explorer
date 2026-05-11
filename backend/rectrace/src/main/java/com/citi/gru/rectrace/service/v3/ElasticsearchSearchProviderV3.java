package com.citi.gru.rectrace.service.v3;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.index.query.Operator;
import org.elasticsearch.index.query.QueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.collapse.CollapseBuilder;
import org.elasticsearch.search.sort.FieldSortBuilder;
import org.elasticsearch.search.sort.ScoreSortBuilder;
import org.elasticsearch.search.sort.SortBuilder;
import org.elasticsearch.search.sort.SortOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import com.citi.gru.rectrace.dto.ElasticsearchProviderConfig;
import com.citi.gru.rectrace.dto.SearchCategoryConfig;
import com.citi.gru.rectrace.dto.SearchCategoryDefinition;
import com.citi.gru.rectrace.dto.SearchCategoryResult;
import com.citi.gru.rectrace.service.SearchConfigServiceV3;

@Service
public class ElasticsearchSearchProviderV3 {

    private static final Logger logger = LoggerFactory.getLogger(ElasticsearchSearchProviderV3.class);
    private static final int INITIAL_SEARCH_SIZE = 500;

    private final RestHighLevelClient restHighLevelClient;
    private final SearchConfigServiceV3 searchConfigServiceV3;

    @Autowired
    public ElasticsearchSearchProviderV3(RestHighLevelClient restHighLevelClient,
            SearchConfigServiceV3 searchConfigServiceV3) {
        this.restHighLevelClient = restHighLevelClient;
        this.searchConfigServiceV3 = searchConfigServiceV3;
    }

    /**
     * Perform keyword search only - returns collapsed groups
     * This is the simplified version that only handles initial keyword search
     */
    public SearchCategoryResult performKeywordSearch(String categoryKey, String searchTerm) {
        logger.info("ES V3 Keyword Search: Category: {}, Term: '{}'", categoryKey, searchTerm);

        // Get ES configuration for the category
        ElasticsearchProviderConfig esConfig = searchConfigServiceV3.getKeywordSearchConfig(categoryKey);
        if (esConfig == null) {
            logger.warn("ES V3 Keyword Search: No valid ES config found for category '{}'", categoryKey);
            return null;
        }

        logger.info("ES V3 Keyword Search: Retrieved ES config for category '{}': index={}, queryFields={}",
                categoryKey, esConfig.getTargetIndex(),
                esConfig.getQueryFields() != null ? String.join(", ", esConfig.getQueryFields()) : "none");

        // Get category definition for building result
        SearchCategoryDefinition categoryDefinition = searchConfigServiceV3.getCategoryDefinition(categoryKey);
        if (categoryDefinition == null) {
            logger.warn("ES V3 Keyword Search: No category definition found for '{}'", categoryKey);
            return null;
        }

        try {
            // Build search source for keyword search
            SearchSourceBuilder sourceBuilder = buildKeywordSearchSourceBuilder(esConfig, searchTerm);

            SearchRequest searchRequest = new SearchRequest(esConfig.getTargetIndex()).source(sourceBuilder);
            logger.debug("Executing ES V3 Keyword Search for category {}: Query DSL: {}", categoryKey, sourceBuilder);

            SearchResponse searchResponse = restHighLevelClient.search(searchRequest, RequestOptions.DEFAULT);
            logger.debug("ES V3 Keyword Search for category {}: ES Response - Total hits: {}, Max score: {}",
                    categoryKey, searchResponse.getHits().getTotalHits().value, searchResponse.getHits().getMaxScore());

            List<Map<String, Object>> data = extractDataFromResponse(searchResponse);
            logger.info("ES V3 Keyword Search for category {}: Returned {} hits.", categoryKey, data.size());
            return buildResultDto(categoryDefinition, data);

        } catch (Exception e) {
            logger.error("Error during ES V3 Keyword Search for category {}: {}", categoryKey, e.getMessage(), e);
            return null;
        }
    }

    /**
     * Build search source builder for keyword search only
     */
    private SearchSourceBuilder buildKeywordSearchSourceBuilder(ElasticsearchProviderConfig esConfig,
            String searchTerm) {
        SearchSourceBuilder sourceBuilder = new SearchSourceBuilder();

        // Build query for keyword search
        QueryBuilder queryBuilder = buildKeywordQuery(esConfig, searchTerm);
        sourceBuilder.query(queryBuilder);

        // Set size
        sourceBuilder.size(INITIAL_SEARCH_SIZE);

        // Apply collapse if configured
        if (StringUtils.hasText(esConfig.getCollapseOnPrecomputedField())) {
            CollapseBuilder collapseBuilder = new CollapseBuilder(esConfig.getCollapseOnPrecomputedField());
            sourceBuilder.collapse(collapseBuilder);
        }

        // Apply sorting
        if (esConfig.getDefaultSort() != null && StringUtils.hasText(esConfig.getDefaultSort().getField())) {
            ElasticsearchProviderConfig.SortConfig sortConfig = esConfig.getDefaultSort();
            SortOrder sortOrder = "desc".equalsIgnoreCase(sortConfig.getDirection()) ? SortOrder.DESC : SortOrder.ASC;
            SortBuilder<?> sortBuilder = "_score".equalsIgnoreCase(sortConfig.getField())
                    ? new ScoreSortBuilder().order(sortOrder)
                    : new FieldSortBuilder(sortConfig.getField()).order(sortOrder);
            sourceBuilder.sort(sortBuilder);
        }

        // Fetch only essential fields for keyword search
        if (!CollectionUtils.isEmpty(esConfig.getResultFields())) {
            sourceBuilder.fetchSource(esConfig.getResultFields().toArray(new String[0]), null);
        }

        return sourceBuilder;
    }

    /**
     * Build keyword query for search
     */
    private QueryBuilder buildKeywordQuery(ElasticsearchProviderConfig esConfig, String searchTerm) {
        // Escape special characters in search term
        String escapedSearchTerm = escapeElasticsearchQueryString(searchTerm);

        // Build a bool query that combines analyzed and keyword fields
        org.elasticsearch.index.query.BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();

        // Separate analyzed fields from keyword fields
        List<String> analyzedFields = new ArrayList<>();
        List<String> keywordFields = new ArrayList<>();

        for (String field : esConfig.getQueryFields()) {
            if (field.endsWith(".keyword")) {
                keywordFields.add(field);
            } else {
                analyzedFields.add(field);
            }
        }

        // Add analyzed field queries (these are case-insensitive by default)
        if (!analyzedFields.isEmpty()) {
            String analyzedQueryString = "*" + escapedSearchTerm + "*";
            Map<String, Float> analyzedFieldBoosts = new HashMap<>();
            for (String field : analyzedFields) {
                analyzedFieldBoosts.put(field, 1.0f);
            }

            boolQuery.should(QueryBuilders.queryStringQuery(analyzedQueryString)
                    .fields(analyzedFieldBoosts)
                    .analyzeWildcard(true)
                    .defaultOperator(Operator.OR));
        }

        // Add case-insensitive keyword field queries
        if (!keywordFields.isEmpty()) {
            for (String keywordField : keywordFields) {
                // Use wildcard query with case-insensitive pattern
                String wildcardPattern = "*" + escapedSearchTerm + "*";
                boolQuery.should(QueryBuilders.wildcardQuery(keywordField, wildcardPattern));
            }
        }

        // Apply relevance boost if configured
        if (esConfig.getRelevanceBoost() != null) {
            // Note: Boost is applied at the field level, so we need to handle it
            // differently
            // For now, we'll use the default boost of 1.0f
        }

        return boolQuery;
    }

    /**
     * Extract data from search response
     */
    private List<Map<String, Object>> extractDataFromResponse(SearchResponse searchResponse) {
        List<Map<String, Object>> data = new ArrayList<>();

        if (searchResponse.getHits() != null && searchResponse.getHits().getHits() != null) {
            for (SearchHit hit : searchResponse.getHits().getHits()) {
                data.add(hit.getSourceAsMap());
            }
        }

        return data;
    }

    /**
     * Build result DTO from extracted data
     */
    private SearchCategoryResult buildResultDto(SearchCategoryDefinition categoryDefinition,
            List<Map<String, Object>> data) {
        // Create SearchCategoryConfig from category definition
        SearchCategoryConfig config = new SearchCategoryConfig();
        config.setKey(categoryDefinition.getKey());
        config.setLabel(categoryDefinition.getLabel());
        config.setColumns(categoryDefinition.getColumns());

        // Create result using the correct constructor
        SearchCategoryResult result = new SearchCategoryResult(config, data);
        return result;
    }

    /**
     * Escape special characters in Elasticsearch query string
     */
    private String escapeElasticsearchQueryString(String input) {
        if (input == null)
            return "";
        final String[] META_CHARS = { "\\", "+", "-", "!", "(", ")", ":", "^", "[", "]", "\"", "{", "}", "~", "|", "&",
                "/" };
        String output = input;
        return output;
    }
}