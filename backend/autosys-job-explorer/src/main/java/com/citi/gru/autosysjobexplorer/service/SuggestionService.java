package com.citi.gru.autosysjobexplorer.service;

import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.suggest.Suggest;
import org.elasticsearch.search.suggest.SuggestBuilder;
import org.elasticsearch.search.suggest.SuggestBuilders;
import org.elasticsearch.search.suggest.completion.CompletionSuggestion;
import org.elasticsearch.search.suggest.completion.CompletionSuggestionBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

@Service
public class SuggestionService {

    private static final Logger logger = LoggerFactory.getLogger(SuggestionService.class);

    private final RestHighLevelClient restHighLevelClient;

    @Value("${es.index.name:autosys_jobs_index}")
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
    public SuggestionService(RestHighLevelClient restHighLevelClient) {
        this.restHighLevelClient = restHighLevelClient;
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
            // 1. Build SuggestBuilder with multiple CompletionSuggesters
            SuggestBuilder suggestBuilder = new SuggestBuilder();
            for (String fieldName : suggestionFields) {
                CompletionSuggestionBuilder completionSuggestionBuilder = SuggestBuilders
                        .completionSuggestion(fieldName) // Target the specific _suggest field
                        .prefix(prefix)
                        .skipDuplicates(true)
                        .size(SUGGESTIONS_PER_FIELD); // Get a few suggestions for each field type

                // Use the field name as the suggester name for easy retrieval
                suggestBuilder.addSuggestion(fieldName, completionSuggestionBuilder);
            }

            // 2. Build the SearchSourceBuilder
            SearchSourceBuilder sourceBuilder = new SearchSourceBuilder();
            sourceBuilder.suggest(suggestBuilder);
            sourceBuilder.fetchSource(false); // Don't need _source
            sourceBuilder.size(0); // Don't need hits

            // 3. Build the SearchRequest
            SearchRequest searchRequest = new SearchRequest(esIndexName);
            searchRequest.source(sourceBuilder);

            // 4. Execute the request
            SearchResponse searchResponse = restHighLevelClient.search(searchRequest, RequestOptions.DEFAULT);

            // 5. Process the Suggestion Response
            Suggest suggest = searchResponse.getSuggest();
            if (suggest == null) {
                logger.debug("No 'suggest' block found in ES response for prefix '{}'", prefix);
                return Collections.emptyList();
            }

            // 6. Collect and Combine Suggestions from all suggesters
            Set<String> combinedSuggestions = new LinkedHashSet<>(); // Use LinkedHashSet to preserve order roughly but ensure uniqueness
            for (String fieldName : suggestionFields) {
                CompletionSuggestion completionSuggestion = suggest.getSuggestion(fieldName); // Get suggestions by field name
                if (completionSuggestion != null && !CollectionUtils.isEmpty(completionSuggestion.getOptions())) {
                    completionSuggestion.getOptions().forEach(option ->
                            combinedSuggestions.add(option.getText().string())
                    );
                }
                // Limit total number early if needed
                if (combinedSuggestions.size() >= MAX_TOTAL_SUGGESTIONS) {
                    break;
                }
            }

            // Limit the final list size
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
