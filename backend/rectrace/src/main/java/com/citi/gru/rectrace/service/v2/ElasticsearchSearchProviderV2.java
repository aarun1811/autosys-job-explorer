package com.citi.gru.rectrace.service.v2;

import com.citi.gru.rectrace.dto.ElasticsearchProviderConfig;
import com.citi.gru.rectrace.dto.SearchCategoryConfig;
import com.citi.gru.rectrace.dto.SearchCategoryDefinition;
import com.citi.gru.rectrace.dto.SearchCategoryResult;
import org.elasticsearch.action.search.ClearScrollRequest;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.action.search.SearchScrollRequest;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.core.TimeValue;
import org.elasticsearch.index.query.Operator;
import org.elasticsearch.index.query.QueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.search.Scroll;
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

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ElasticsearchSearchProviderV2 {

    private static final Logger logger = LoggerFactory.getLogger(ElasticsearchSearchProviderV2.class);
    private static final int INITIAL_SEARCH_SIZE = 500;
    private static final String SCROLL_KEEP_ALIVE_STRING = "1m";
    private final RestHighLevelClient restHighLevelClient;

    @Autowired
    public ElasticsearchSearchProviderV2(RestHighLevelClient restHighLevelClient) {
        this.restHighLevelClient = restHighLevelClient;
    }

        public SearchCategoryResult performPaginatedSearch(SearchCategoryDefinition categoryDefinition, String searchTerm
                , List<String> essentialFieldsToFetch) {
        logger.info("ES V2 Paginated Search: Category: {}, Term: '{}', Essential Fields: {}",
                categoryDefinition.getKey(), searchTerm, essentialFieldsToFetch);

        ElasticsearchProviderConfig esConfig = getAndValidateEsConfig(categoryDefinition);
        if (esConfig == null) return null;

        try {
                SearchSourceBuilder sourceBuilder = buildSearchSourceBuilder(
                        esConfig,
                        searchTerm,
                        essentialFieldsToFetch, // These are used for _source
                        false, // isScrollQuery = false
                        INITIAL_SEARCH_SIZE
                );
                SearchRequest searchRequest = new SearchRequest(esConfig.getTargetIndex()).source(sourceBuilder);
                logger.debug("Executing Paginated Search for category {}: Query DSL: {}", categoryDefinition.getKey(),
                        sourceBuilder);
                SearchResponse searchResponse = restHighLevelClient.search(searchRequest, RequestOptions.DEFAULT);
                List<Map<String, Object>> data = extractDataFromResponse(searchResponse);

                logger.info("ES V2 Paginated Search for category {}: Returned {} hits after potential collapsing.",
                        categoryDefinition.getKey(), data.size());
                return buildResultDto(categoryDefinition, data);
        } catch (Exception e) {
                logger.error("Error during ES V2 Paginated Search for category {}: {}", categoryDefinition.getKey(),
                        e.getMessage(), e);
                return null;
        }
    }

    public SearchCategoryResult fetchAllResultsUsingScroll(SearchCategoryDefinition categoryDefinition,
                                                        String searchTerm, List<String> requestedDetailedFields) {
        logger.info("ES V2 Scroll Search: Category: {}, Term: '{}', Requested Detailed Fields: {}",
                categoryDefinition.getKey(), searchTerm, requestedDetailedFields);

        ElasticsearchProviderConfig esConfig = getAndValidateEsConfig(categoryDefinition);
        if (esConfig == null) return null;
        if (CollectionUtils.isEmpty(requestedDetailedFields)) {
                logger.warn("ES V2 Scroll Search for category {}: No detailed fields requested. Returning empty.",
                        categoryDefinition.getKey());
                return buildResultDto(categoryDefinition, Collections.emptyList());
        }

        List<Map<String, Object>> allHits = new ArrayList<>();
        String scrollId = null;

        try {
            final Scroll scroll = new Scroll(TimeValue.parseTimeValue(SCROLL_KEEP_ALIVE_STRING, null,
                    getClass().getSimpleName() + ".SCROLL_KEEP_ALIVE_STRING"));

            SearchSourceBuilder sourceBuilder = buildSearchSourceBuilder(
                    esConfig,
                    searchTerm,
                    requestedDetailedFields,
                    true, // isScrollQuery = true
                    100 // Batch size for each scroll request
            );
            SearchRequest searchRequest =
                new SearchRequest(esConfig.getTargetIndex()).source(sourceBuilder).scroll(scroll);
            logger.debug("Executing Scroll Search (initial) for category {}: Query DSL: {}",
                    categoryDefinition.getKey(), sourceBuilder);
            SearchResponse searchResponse = restHighLevelClient.search(searchRequest, RequestOptions.DEFAULT);

            scrollId = searchResponse.getScrollId();
            SearchHit[] searchHits = searchResponse.getHits().getHits();
            int batchNum = 0;

            while (searchHits != null && searchHits.length > 0) {
                batchNum++;
                logger.trace("Scroll Batch {} for category {}: {} hits, Scroll ID: {}", batchNum,
                        categoryDefinition.getKey(), searchHits.length, scrollId);
                for (SearchHit hit : searchHits) {
                    logger.trace("Processing hit with _id: {} for category {}", hit.getId(),
                            categoryDefinition.getKey());
                    allHits.add(hit.getSourceAsMap());
                }

                SearchScrollRequest scrollRequest = new SearchScrollRequest(scrollId).scroll(scroll);
                searchResponse = restHighLevelClient.scroll(scrollRequest, RequestOptions.DEFAULT);
                scrollId = searchResponse.getScrollId();
                searchHits = searchResponse.getHits().getHits();
            }
            logger.info("ES V2 Scroll Search: Fetched {} total hits raw from scroll for category {}", allHits.size(),
                    categoryDefinition.getKey());

            // Client-side deduplication based on the specific requestedDetailedFields for this detailed view
            if (!allHits.isEmpty()) {
                logger.debug("Attempting client-side deduplication based on {} detailed fields for category {}",
                        requestedDetailedFields.size(), categoryDefinition.getKey());
                List<Map<String, Object>> deduplicatedHits = new ArrayList<>();
                Set<String> seenKeys = new HashSet<>();
                for (Map<String, Object> hitMap : allHits) {
                    String duplicateCheckKey = requestedDetailedFields.stream()
                            .map(field -> String.valueOf(hitMap.get(field)))
                            .collect(Collectors.joining("||"));
                    if (seenKeys.add(duplicateCheckKey)) {
                        deduplicatedHits.add(hitMap);
                    }
                }
                logger.info("(category {}) resulted in {} unique hits " +
                                "(was {} raw hits)",
                        categoryDefinition.getKey(), deduplicatedHits.size(), allHits.size());
                allHits = deduplicatedHits;
            }
            return buildResultDto(categoryDefinition, allHits);

        } catch (Exception e) {
            logger.error("{}: {}", categoryDefinition.getKey(),
                    e.getMessage(), e);
            return null;
        } finally {
            if (StringUtils.hasText(scrollId)) {
                clearScrollContext(scrollId);
            }
        }
    }

    private ElasticsearchProviderConfig getAndValidateEsConfig(SearchCategoryDefinition categoryDefinition) {
        if (!(categoryDefinition.getProviderConfig() instanceof ElasticsearchProviderConfig)) {
            logger.error("Invalid config for ES Provider V2. Category: {}. Expected ElasticsearchProviderConfig.",
                    categoryDefinition.getKey());
            return null;
        }
        ElasticsearchProviderConfig esConfig = (ElasticsearchProviderConfig) categoryDefinition.getProviderConfig();
        if (!StringUtils.hasText(esConfig.getTargetIndex()) || CollectionUtils.isEmpty(esConfig.getQueryFields())) {
            logger.error("ES Provider V2 config invalid for category {}: Missing targetIndex or queryFields.",
                    categoryDefinition.getKey());
            return null;
        }
        return esConfig;
    }
    
    private SearchSourceBuilder buildSearchSourceBuilder(
            ElasticsearchProviderConfig esConfig,
            String searchTerm,
            List<String> fieldsForSource, // These are the fields for _source
            boolean isScrollQuery,
            int size) {
    
        String escapedSearchTerm = escapeElasticsearchQueryString(searchTerm);
        String queryString = "*" + escapedSearchTerm + "*";
    
        Map<String, Float> queryFieldsWithBoosts = esConfig.getQueryFields().stream()
                .collect(Collectors.toMap(f -> f, f -> 1.0f));
    
        if (esConfig.getRelevanceBoost() != null) {
            esConfig.getRelevanceBoost().forEach((field, boost) -> {
                if (queryFieldsWithBoosts.containsKey(field)) {
                    queryFieldsWithBoosts.put(field, boost.floatValue());
                }
            });
        }
    
        QueryBuilder esQuery = QueryBuilders.queryStringQuery(queryString)
                .fields(queryFieldsWithBoosts)
                .analyzeWildcard(true)
                .defaultOperator(Operator.AND);
    
        SearchSourceBuilder sourceBuilder = new SearchSourceBuilder().query(esQuery);
    
        if (!CollectionUtils.isEmpty(fieldsForSource)) {
            sourceBuilder.fetchSource(fieldsForSource.toArray(new String[0]), null);
        } else {
            sourceBuilder.fetchSource(true);
        }
    
        if (esConfig.getDefaultSort() != null && StringUtils.hasText(esConfig.getDefaultSort().getField())) {
            ElasticsearchProviderConfig.SortConfig sortConfig = esConfig.getDefaultSort();
            SortOrder sortOrder = "desc".equalsIgnoreCase(sortConfig.getDirection()) ? SortOrder.DESC : SortOrder.ASC;
            SortBuilder<?> sortBuilder = "_score".equalsIgnoreCase(sortConfig.getField()) ?
                    new ScoreSortBuilder().order(sortOrder) :
                    new FieldSortBuilder(sortConfig.getField()).order(sortOrder);
            sourceBuilder.sort(sortBuilder);
        } else if (!isScrollQuery) {
            sourceBuilder.sort(new ScoreSortBuilder().order(SortOrder.DESC));
        }
    
        sourceBuilder.size(size);

        if (!isScrollQuery) {
            sourceBuilder.from(0);
            // Use pre-computed field for collapsing if configured
            if (StringUtils.hasText(esConfig.getCollapseOnPrecomputedField())) {
                logger.debug("Applying field collapsing on precomputed field: {} for category/index {}",
                        esConfig.getCollapseOnPrecomputedField(), esConfig.getTargetIndex());
                sourceBuilder.collapse(new CollapseBuilder(esConfig.getCollapseOnPrecomputedField()));
            } else {
                logger.debug("No collapseOnPrecomputedField configured for category/index {}. Skipping collapsing for" +
                        " paginated search.", esConfig.getTargetIndex());
            }
        }
        return sourceBuilder;
    }

    private List<Map<String, Object>> extractDataFromResponse(SearchResponse searchResponse) {
        return Arrays.stream(searchResponse.getHits().getHits())
                .map(SearchHit::getSourceAsMap)
                .collect(Collectors.toList());
    }

    SearchCategoryResult buildResultDto(SearchCategoryDefinition categoryDefinition, List<Map<String, Object>> data) {
        SearchCategoryConfig minimalConfigDto = new SearchCategoryConfig();
        minimalConfigDto.setKey(categoryDefinition.getKey());
        minimalConfigDto.setLabel(categoryDefinition.getLabel());
        minimalConfigDto.setColumns(categoryDefinition.getColumns());
        return new SearchCategoryResult(minimalConfigDto, data);
    }

    private void clearScrollContext(String scrollId) {
        ClearScrollRequest clearScrollRequest = new ClearScrollRequest();
        clearScrollRequest.addScrollId(scrollId);
        try {
            restHighLevelClient.clearScroll(clearScrollRequest, RequestOptions.DEFAULT);
            logger.debug("Successfully cleared ES scroll context with ID: {}", scrollId);
        } catch (IOException e) {
            logger.warn("Failed to clear ES scroll context with ID: {}. Error: {}", scrollId, e.getMessage());
        }
    }

    private String escapeElasticsearchQueryString(String input) {
        if (input == null) return "";
        final String[] META_CHARS = {"\\", "+", "-", "!", "(", ")", ":", "^", "[", "]", "\"", "{", "}", "~"
                , "|", "&", "/"};
        String output = input;
        for (String metaChar : META_CHARS) {
            if (output.contains(metaChar)) {
                output = output.replace(metaChar, "\\" + metaChar);
            }
        }
        return output;
    }
}
    