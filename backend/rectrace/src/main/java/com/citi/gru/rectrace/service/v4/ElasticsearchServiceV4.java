package com.citi.gru.rectrace.service.v4;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.SortOrder;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch._types.query_dsl.WildcardQuery;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.Hit;
import com.citi.gru.rectrace.dto.v4.CategoryConfigV4;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@Slf4j
public class ElasticsearchServiceV4 {

    @Autowired(required = false)
    private ElasticsearchClient esClient;

    @SuppressWarnings({"rawtypes", "unchecked"})
    public List<String> getUniqueValues(String keyword, CategoryConfigV4 config) {
        if (esClient == null) {
            log.warn("Elasticsearch client not configured, returning empty results");
            return new ArrayList<>();
        }

        final String pattern = "*" + keyword.toLowerCase() + "*";
        final String index = config.getElasticsearch().getIndex();
        final String collapseField = config.getElasticsearch().getCollapseField();
        final String searchColumn = config.getSearchColumn();
        final int size = config.getElasticsearch().getMaxResults();

        // Phase 8 / BUG-02 fix:
        // Build wildcard `should` clauses for every configured search field. Two branches:
        //   - `.keyword` subfields are case-preserving (e.g. `RID-XYZ-42`), so the lowercased
        //     pattern would never match them with a default wildcard. We enable
        //     case_insensitive=true on these clauses so hyphenated identifiers typed in any
        //     case still match the case-preserved indexed term.
        //   - Plain text fields keep the original (case-sensitive) WildcardQuery; their
        //     analyzed tokens are already lowercased at index time, so the lowercased pattern
        //     stays analyzer-aligned. (Hyphenated literals never match text-tokenised fields
        //     anyway because the analyzer destroys the hyphen — see HYPHEN-DIAGNOSTIC.md.)
        long keywordBranchCount = config.getElasticsearch().getSearchFields().stream()
                .filter(f -> f.endsWith(".keyword")).count();
        log.debug("Building {} wildcard should clauses ({} with caseInsensitive on .keyword) for category={}",
                config.getElasticsearch().getSearchFields().size(), keywordBranchCount, config.getKey());

        List<Query> shoulds = config.getElasticsearch().getSearchFields().stream()
                .map(field -> buildWildcard(field, pattern))
                .collect(Collectors.toList());

        try {
            log.debug("Executing ES query for category: {}, keyword: {}", config.getKey(), keyword);
            SearchResponse<Map> response = esClient.search(s -> s
                            .index(index)
                            .query(q -> q.bool(b -> b.should(shoulds)))
                            .collapse(c -> c.field(collapseField))
                            .size(size)
                            .source(src -> src.filter(f -> f.includes(searchColumn)))
                            .sort(so -> so.field(f -> f.field(collapseField).order(SortOrder.Asc))),
                    Map.class);

            List<String> results = response.hits().hits().stream()
                    .map(Hit::source)
                    .filter(Objects::nonNull)
                    .map(this::extractValue)
                    .filter(value -> value != null && !value.isEmpty())
                    .collect(Collectors.toList());

            log.info("ES search for category {} returned {} unique values", config.getKey(), results.size());
            return results;

        } catch (IOException e) {
            log.error("Elasticsearch query failed for category: {}", config.getKey(), e);
            return new ArrayList<>();
        } catch (Exception e) {
            log.error("Unexpected error during ES query for category: {}", config.getKey(), e);
            return new ArrayList<>();
        }
    }

    /**
     * Phase 8 / BUG-02: case-insensitive wildcard for `.keyword`-subfield branches.
     *
     * <p>The `.keyword` subfield preserves the original (often uppercase) literal at index
     * time. The pattern arrives lowercased to stay analyzer-aligned with the parallel text
     * branch; without {@code caseInsensitive(true)} the lowercased pattern can never match
     * the case-preserved indexed term, producing zero hits for hyphenated identifiers like
     * {@code RECON-XYZ-42}, {@code RID-XYZ-42}, {@code SET-ABC-123}.
     *
     * <p>This branch is additive and does not change the text-field path.
     */
    private Query buildWildcard(String field, String pattern) {
        if (field.endsWith(".keyword")) {
            return WildcardQuery.of(w -> w.field(field).value(pattern).caseInsensitive(true))
                    ._toQuery();
        }
        return WildcardQuery.of(w -> w.field(field).value(pattern))._toQuery();
    }

    private String extractValue(Map<String, Object> sourceMap) {
        try {
            if (sourceMap == null || sourceMap.isEmpty()) {
                return null;
            }
            // Get the first non-null value from the source
            Object value = sourceMap.values().stream()
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(null);
            return value != null ? value.toString() : null;
        } catch (Exception e) {
            log.warn("Failed to extract value from ES hit", e);
            return null;
        }
    }
}
