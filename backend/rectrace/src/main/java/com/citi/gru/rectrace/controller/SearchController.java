package com.citi.gru.rectrace.controller;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.citi.gru.rectrace.dto.SearchCategoryResult;
import com.citi.gru.rectrace.service.SuggestionService;
import com.citi.gru.rectrace.service.v2.SearchServiceV2;
import com.citi.gru.rectrace.service.v3.ElasticsearchSearchProviderV3;
import com.citi.gru.rectrace.service.v3.OracleSearchProviderV3;

@RestController
@RequestMapping("/api")
public class SearchController {

    private static final Logger logger = LoggerFactory.getLogger(SearchController.class);

    private static final String CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid";

    private final SuggestionService suggestionService;

    private final SearchServiceV2 searchServiceV2;
    private final ElasticsearchSearchProviderV3 elasticsearchSearchProviderV3;
    private final OracleSearchProviderV3 oracleSearchProviderV3;

    public SearchController(
            SuggestionService suggestionService,
            SearchServiceV2 searchServiceV2,
            ElasticsearchSearchProviderV3 elasticsearchSearchProviderV3,
            OracleSearchProviderV3 oracleSearchProviderV3) {
        this.suggestionService = suggestionService;
        this.searchServiceV2 = searchServiceV2;
        this.elasticsearchSearchProviderV3 = elasticsearchSearchProviderV3;
        this.oracleSearchProviderV3 = oracleSearchProviderV3;
    }

    @GetMapping("/search/suggest")
    public List<String> suggest(@RequestParam(name = "prefix") String prefix) {
        return suggestionService.getCombinedSuggestions(prefix);
    }

    @GetMapping("/v2/search")
    public Map<String, SearchCategoryResult> searchV2(
            @RequestParam(name = "q") String query,
            @RequestParam(name = "category", required = false) String category,
            @RequestParam(name = "requestedFields", required = false) String requestedFieldsCsv,
            @RequestParam(name = "collapsed", defaultValue = "true") boolean collapsed,
            @RequestParam(name = "groupKey", required = false) String groupKey,
            HttpServletRequest request) {
        String loginId = request.getHeader(CITI_PORTAL_LOGIN_ID_HEADER);
        
        if (category != null && requestedFieldsCsv != null) {
            List<String> fields = Arrays.asList(requestedFieldsCsv.split("\\s*,\\s*"));
            logger.info("Category Search performed by user: {} for the term: {} for the category: {} and the fields: {}",
                    loginId, query, category, fields);
            return searchServiceV2.fetchDetailedCategorySearch(query, category, fields);
        }
        
        if (category != null && groupKey != null) {
            // Group expansion mode
            List<String> fields = requestedFieldsCsv != null ? 
                Arrays.asList(requestedFieldsCsv.split("\\s*,\\s*")) : null;
            logger.info("Group Expansion performed by user: {} for the term: {} for the category: {} and group: {}",
                    loginId, query, category, groupKey);
            return searchServiceV2.expandGroup(query, category, groupKey, fields);
        }
        
        logger.info("Search performed by user: {} for the term: {} (collapsed: {})", loginId, query, collapsed);
        return searchServiceV2.performInitialSearch(query, collapsed);
    }

    // NEW: V3 endpoints for simplified search architecture

    @GetMapping("/v3/search/keyword")
    public Map<String, SearchCategoryResult> keywordSearchV3(
            @RequestParam(name = "q") String query,
            @RequestParam(name = "category", required = false) String category,
            HttpServletRequest request) {
        String loginId = request.getHeader(CITI_PORTAL_LOGIN_ID_HEADER);
        
        logger.info("V3 Keyword Search performed by user: {} for the term: {} category: {}", 
                loginId, query, category);
        
        if (category != null) {
            // Search specific category
            SearchCategoryResult result = elasticsearchSearchProviderV3.performKeywordSearch(category, query);
            if (result != null) {
                return Collections.singletonMap(category, result);
            }
            return Collections.emptyMap();
        } else {
            // Search all categories (simplified - just return first valid category for now)
            // In a full implementation, this would search all categories
            logger.warn("V3 Keyword Search: No category specified, returning empty result");
            return Collections.emptyMap();
        }
    }

    @GetMapping("/v3/search/expand")
    public Map<String, SearchCategoryResult> expandGroupV3(
            @RequestParam(name = "q") String query,
            @RequestParam(name = "category") String category,
            @RequestParam(name = "groupKey") String groupKey,
            HttpServletRequest request) {
        String loginId = request.getHeader(CITI_PORTAL_LOGIN_ID_HEADER);
        
        logger.info("V3 Group Expansion performed by user: {} for the term: {} category: {} group: {}", 
                loginId, query, category, groupKey);
        
        SearchCategoryResult result = oracleSearchProviderV3.expandGroup(category, groupKey, query);
        if (result != null) {
            return Collections.singletonMap(category, result);
        }
        return Collections.emptyMap();
    }
}
