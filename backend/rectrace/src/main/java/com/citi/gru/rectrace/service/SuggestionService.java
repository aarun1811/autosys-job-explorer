package com.citi.gru.rectrace.service;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.CompletionSuggestOption;
import co.elastic.clients.elasticsearch.core.search.FieldSuggester;
import co.elastic.clients.elasticsearch.core.search.Suggester;
import co.elastic.clients.elasticsearch.core.search.Suggestion;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class SuggestionService {

    private static final Logger logger = LoggerFactory.getLogger(SuggestionService.class);

    private final ElasticsearchClient esClient;

    @Value("${es.index.name:rectrace_core_index}")
    private String esIndexName;

    // Define the fields we want to get suggestions from
    private static final List<String> suggestionFields = Arrays.asList(
            "recon_suggest",
            "box_name_suggest",
            "machine_suggest",
            "run_calendar_suggest",
            "exclude_calendar_suggest",
            "job_name_suggest",
            "sub_acc_suggest",
            "set_id_suggest"
    );

    // Max suggestions PER FIELD type
    private static final int SUGGESTIONS_PER_FIELD = 4;
     // Total max suggestions to return in the combined list
    private static final int MAX_TOTAL_SUGGESTIONS = 10;


    @Autowired
    public SuggestionService(ElasticsearchClient esClient) {
        this.esClient = esClient;
    }

    /**
     * Fetches combined search suggestions for a prefix across multiple configured fields.
     *
     * @param prefix The user's current input prefix.
     * @return A list of unique suggestion strings, or an empty list if none found or on error.
     */
    public List<String> getCombinedSuggestions(String prefix) {
        // Basic validation
        if (!StringUtils.hasText(prefix)) {
            return Collections.emptyList();
        }
        // Don't suggest on very short prefixes if not desired
        if (prefix.length() < 1) { // Example: require at least 2 characters
             logger.trace("Prefix '{}' too short for suggestions.", prefix);
             return Collections.emptyList();
        }

        logger.debug("Getting combined suggestions for prefix '{}'", prefix);

        try {
            // 1. Build one FieldSuggester per target field, keyed by field name for retrieval.
            Map<String, FieldSuggester> namedSuggesters = new LinkedHashMap<>();
            for (String fieldName : suggestionFields) {
                final String f = fieldName;
                namedSuggesters.put(fieldName, FieldSuggester.of(fs -> fs
                        .prefix(prefix)
                        .completion(c -> c.field(f).skipDuplicates(true).size(SUGGESTIONS_PER_FIELD))
                ));
            }

            // 2. Execute the suggest-only search (no _source, no hits).
            SearchResponse<Void> response = esClient.search(s -> s
                            .index(esIndexName)
                            .size(0)
                            .source(src -> src.fetch(false))
                            .suggest(Suggester.of(sg -> sg.suggesters(namedSuggesters))),
                    Void.class);

            // 3. Collect and combine suggestions from all suggesters (preserve order, dedup).
            Map<String, List<Suggestion<Void>>> suggestMap = response.suggest();
            if (suggestMap == null || suggestMap.isEmpty()) {
                logger.debug("No 'suggest' block found in ES response for prefix '{}'", prefix);
                return Collections.emptyList();
            }

            Set<String> combinedSuggestions = new LinkedHashSet<>();
            outer:
            for (String fieldName : suggestionFields) {
                List<Suggestion<Void>> sugs = suggestMap.get(fieldName);
                if (sugs == null) {
                    continue;
                }
                for (Suggestion<Void> sug : sugs) {
                    for (CompletionSuggestOption<Void> opt : sug.completion().options()) {
                        combinedSuggestions.add(opt.text());
                        if (combinedSuggestions.size() >= MAX_TOTAL_SUGGESTIONS) {
                            break outer;
                        }
                    }
                }
            }

            // 4. Limit the final list size (defensive — outer break above already caps it).
            List<String> finalSuggestions = combinedSuggestions.stream()
                    .limit(MAX_TOTAL_SUGGESTIONS)
                    .collect(Collectors.toList());

            logger.debug("Found {} combined suggestions for prefix '{}'", finalSuggestions.size(), prefix);
            return finalSuggestions;

        } catch (IOException e) {
            logger.error("IOException during combined Elasticsearch suggestion request for prefix '{}': {}", prefix, e.getMessage());
            return Collections.emptyList(); // Return empty on communication error
        } catch (Exception e) {
            logger.error("Unexpected error getting combined suggestions for prefix '{}': {}", prefix, e.getMessage(), e);
            return Collections.emptyList(); // Return empty on other errors
        }
    }
}
