package com.citi.gru.autosysjobexplorer.controller;

import com.citi.gru.autosysjobexplorer.dto.SearchCategoryResult;
import com.citi.gru.autosysjobexplorer.service.EnhancedSearchService;
import com.citi.gru.autosysjobexplorer.service.SuggestionService;
import com.citi.gru.autosysjobexplorer.service.v2.SearchServiceV2;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class SearchController {

    private static final Logger logger = LoggerFactory.getLogger(SearchController.class);

    private static final String CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid";

    private final EnhancedSearchService enhancedSearchService;

    private final SuggestionService suggestionService;

    private final SearchServiceV2 searchServiceV2;

    public SearchController(
            EnhancedSearchService enhancedSearchService,
            SuggestionService suggestionService,
            SearchServiceV2 searchServiceV2) {
        this.enhancedSearchService = enhancedSearchService;
        this.suggestionService = suggestionService;
        this.searchServiceV2 = searchServiceV2;
    }

    @GetMapping("/search")
    public Map<String, SearchCategoryResult> search(@RequestParam(name = "q") String query) {
        return enhancedSearchService.search(query);
    }

    @GetMapping("/search/suggest")
    public List<String> suggest(@RequestParam(name = "prefix") String prefix) {
        return suggestionService.getCombinedSuggestions(prefix);
    }

    @GetMapping("/v2/search")
    public Map<String, SearchCategoryResult> searchV2(
            @RequestParam(name = "q") String query,
            @RequestParam(name = "category", required = false) String category,
            @RequestParam(name = "requestedFields", required = false) String requestedFieldsCsv, HttpServletRequest request) {
        String loginId = request.getHeader(CITI_PORTAL_LOGIN_ID_HEADER);
        if (category != null && requestedFieldsCsv != null) {
            List<String> fields = Arrays.asList(requestedFieldsCsv.split("\\s*,\\s*"));
            logger.info("Category Search performed by user: {} for the term: {} for the category: {} and the fields: {}",
                    loginId, query, category, fields);
            return searchServiceV2.fetchDetailedCategorySearch(query, category, fields);
        }
        logger.info("Search performed by user: {} for the term: {}", loginId, query);
        return searchServiceV2.performInitialSearch(query);
    }
}
