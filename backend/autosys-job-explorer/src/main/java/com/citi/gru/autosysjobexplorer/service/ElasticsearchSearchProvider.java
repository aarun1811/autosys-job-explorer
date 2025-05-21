package com.citi.gru.autosysjobexplorer.service;

// Import DTOs
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.index.query.Operator; // Correct import for Operator
import org.elasticsearch.index.query.QueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.search.builder.SearchSourceBuilder;
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

import com.citi.gru.autosysjobexplorer.dto.ElasticsearchProviderConfig;
import com.citi.gru.autosysjobexplorer.dto.ProviderSpecificConfig;
import com.citi.gru.autosysjobexplorer.dto.SearchCategoryConfig;
import com.citi.gru.autosysjobexplorer.dto.SearchCategoryDefinition;
import com.citi.gru.autosysjobexplorer.dto.SearchCategoryResult;

@Service
public class ElasticsearchSearchProvider implements SearchProvider {

    private static final Logger logger = LoggerFactory.getLogger(ElasticsearchSearchProvider.class);

    // Inject the RestHighLevelClient
    private final RestHighLevelClient restHighLevelClient;

    @Autowired
    public ElasticsearchSearchProvider(RestHighLevelClient restHighLevelClient) {
        this.restHighLevelClient = restHighLevelClient;
    }

    @Override
    public String getProviderType() {
        return "elasticsearch"; // This provider handles 'elasticsearch' type configurations
    }

    @Override
    public SearchCategoryResult search(SearchCategoryDefinition categoryDefinition, String searchTerm) {
        logger.info("Attempting Elasticsearch search for category key: {}, search term: '{}'", categoryDefinition.getKey(), searchTerm);

        // 1. Get and validate the Elasticsearch-specific configuration
        ProviderSpecificConfig genericProviderConfig = categoryDefinition.getProviderConfig();
        if (!(genericProviderConfig instanceof ElasticsearchProviderConfig)) {
            logger.error("Invalid configuration for Elasticsearch search provider. Category key: {}. Expected ElasticsearchProviderConfig but got {}",
                    categoryDefinition.getKey(), genericProviderConfig != null ? genericProviderConfig.getClass().getName() : "null");
            return null; // Cannot proceed without correct config type
        }
        ElasticsearchProviderConfig esConfig = (ElasticsearchProviderConfig) genericProviderConfig;

        // 2. Validate required config fields for Elasticsearch
        if (!StringUtils.hasText(esConfig.getTargetIndex())) {
            logger.error("Elasticsearch search configuration invalid for category '{}': Missing 'targetIndex'.", categoryDefinition.getKey());
            return null;
        }
        if (CollectionUtils.isEmpty(esConfig.getQueryFields())) {
             logger.error("Elasticsearch search configuration invalid for category '{}': Missing or empty 'queryFields'.", categoryDefinition.getKey());
            return null;
        }
        if (CollectionUtils.isEmpty(categoryDefinition.getColumns())) {
             logger.warn("Elasticsearch search category '{}': Missing 'columns' definition. Results might not display correctly.", categoryDefinition.getKey());
             // Proceed, but frontend might have issues without column info
        }


        try {
            // 3. Build the Elasticsearch Query using QueryBuilders
            String escapedSearchTerm = escapeElasticsearchQueryString(searchTerm);
            // Add wildcards for partial matching - adjust if exact match needed or use different query types
            String queryString = "*" + escapedSearchTerm + "*";

            // Prepare map for fields and their boosts
            Map<String, Float> fieldsWithBoosts = esConfig.getQueryFields().stream()
                    .collect(Collectors.toMap(f -> f, f -> 1.0f)); // Default boost 1.0

            // Apply relevance boosts from config if present
            if (esConfig.getRelevanceBoost() != null && !esConfig.getRelevanceBoost().isEmpty()) {
                 esConfig.getRelevanceBoost().forEach((field, boost) -> {
                     // Only apply boost if the field is actually in queryFields
                     if(fieldsWithBoosts.containsKey(field)){
                         fieldsWithBoosts.put(field, boost.floatValue());
                         logger.trace("Applying boost {} to field '{}'", boost.floatValue(), field);
                     } else {
                         logger.warn("Category '{}': Relevance boost specified for field '{}' which is not in queryFields.", categoryDefinition.getKey(), field);
                     }
                 });
            }

            // Build the query_string query
            QueryBuilder esQuery = QueryBuilders.queryStringQuery(queryString)
                    .fields(fieldsWithBoosts)
                    .analyzeWildcard(true) // Allow leading/trailing wildcards
                    .defaultOperator(Operator.AND); // Use AND logic between terms by default

            // 4. Build the SearchSourceBuilder (the request payload)
            SearchSourceBuilder sourceBuilder = new SearchSourceBuilder();
            sourceBuilder.query(esQuery);

            // 4a. Apply source filtering if resultFields are specified
            if (!CollectionUtils.isEmpty(esConfig.getResultFields())) {
                sourceBuilder.fetchSource(esConfig.getResultFields().toArray(new String[0]), null);
                 logger.debug("Applying source filter for category '{}': {}", categoryDefinition.getKey(), esConfig.getResultFields());
            }

            // 4b. Apply sorting
            if (esConfig.getDefaultSort() != null && StringUtils.hasText(esConfig.getDefaultSort().getField())) {
                ElasticsearchProviderConfig.SortConfig sortConfig = esConfig.getDefaultSort();
                SortOrder sortOrder = "desc".equalsIgnoreCase(sortConfig.getDirection()) ? SortOrder.DESC : SortOrder.ASC;
                SortBuilder<?> sortBuilder;
                 if ("_score".equalsIgnoreCase(sortConfig.getField())) {
                     sortBuilder = new ScoreSortBuilder().order(sortOrder);
                 } else {
                     // Assuming field name for sorting includes ".keyword" if needed
                     sortBuilder = new FieldSortBuilder(sortConfig.getField()).order(sortOrder);
                 }
                 sourceBuilder.sort(sortBuilder);
                 logger.debug("Applying sort for category '{}': Field={}, Order={}", categoryDefinition.getKey(), sortConfig.getField(), sortOrder);
             } else {
                  // Default sort by relevance score if nothing else specified
                  sourceBuilder.sort(new ScoreSortBuilder().order(SortOrder.DESC));
                  logger.debug("Applying default sort for category '{}': _score DESC", categoryDefinition.getKey());
             }

            // 4c. Apply pagination
            sourceBuilder.from(0); // Start index
            sourceBuilder.size(500); // Max results (consider making this configurable)

            // 5. Build the SearchRequest
            SearchRequest searchRequest = new SearchRequest(esConfig.getTargetIndex());
            searchRequest.source(sourceBuilder);

            logger.debug("Executing ES Request for category '{}': {}", categoryDefinition.getKey(), sourceBuilder.toString());


            // 6. Execute the Search using RestHighLevelClient
            SearchResponse searchResponse = restHighLevelClient.search(searchRequest, RequestOptions.DEFAULT);


            // 7. Process Results from SearchResponse
            List<Map<String, Object>> data = Arrays.stream(searchResponse.getHits().getHits())
                    .map(hit -> {
                        Map<String, Object> sourceMap = hit.getSourceAsMap();
                        // You could optionally add metadata like _id or _score here if needed
                        // sourceMap.put("_id", hit.getId());
                        // sourceMap.put("_score", hit.getScore());
                        return sourceMap;
                    })
                    .collect(Collectors.toList());

             if (CollectionUtils.isEmpty(data)) {
                 logger.debug("No results found for category '{}'", categoryDefinition.getKey());
             } else {
                  logger.debug("Retrieved {} results for category '{}'", data.size(), categoryDefinition.getKey());
             }

            // 8. Construct the final result DTO
            // Create the minimal SearchCategoryConfig DTO for the response payload
            SearchCategoryConfig minimalConfigDto = new SearchCategoryConfig();
            minimalConfigDto.setKey(categoryDefinition.getKey());
            minimalConfigDto.setLabel(categoryDefinition.getLabel());
            minimalConfigDto.setColumns(categoryDefinition.getColumns()); // Pass the defined grid columns

            logger.info("Elasticsearch search succeeded for category '{}', found {} results.", categoryDefinition.getKey(), data.size());
            return new SearchCategoryResult(minimalConfigDto, data);

        } catch (IOException e) { // Catch IOException from client.search
             logger.error("IOException during Elasticsearch search for category key: {}. Message: {}", categoryDefinition.getKey(), e.getMessage());
             return null; // Indicate failure
        } catch (Exception e) { // Catch other potential exceptions during query building or processing
            logger.error("Error executing Elasticsearch search for category key: {}", categoryDefinition.getKey(), e);
            return null; // Indicate failure
        }
    }

    /**
     * Basic escaping for Elasticsearch query string special characters.
     * Note: This is a simplified escaping, review ES documentation for full requirements
     * for the query_string query syntax if using more complex searches.
     * Characters to escape: + - = && || > < ! ( ) { } [ ] ^ " ~ * ? : \ /
     */
    private String escapeElasticsearchQueryString(String input) {
        if (input == null) return "";
        // Escape characters with special meaning in Lucene query syntax used by query_string
        return input.replaceAll("([+\\-=&|><!(){}\\[\\]^\"~*?:\\\\/])", "\\\\$1");
    }
}