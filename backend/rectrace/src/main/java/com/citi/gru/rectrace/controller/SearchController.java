package com.citi.gru.rectrace.controller;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.citi.gru.rectrace.dto.SearchCategoryResult;
import com.citi.gru.rectrace.service.SuggestionService;
import com.citi.gru.rectrace.service.v2.SearchServiceV2;
import com.citi.gru.rectrace.service.v3.OracleSearchProviderV3;
import com.citi.gru.rectrace.service.v3.SearchServiceV3;

@RestController
@RequestMapping("/api")
public class SearchController {

    private static final Logger logger = LoggerFactory.getLogger(SearchController.class);

    private static final String CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid";

    private final SuggestionService suggestionService;

    private final SearchServiceV2 searchServiceV2;
    private final SearchServiceV3 searchServiceV3;
    private final OracleSearchProviderV3 oracleSearchProviderV3;

    public SearchController(
            SuggestionService suggestionService,
            SearchServiceV2 searchServiceV2,
            SearchServiceV3 searchServiceV3,
            OracleSearchProviderV3 oracleSearchProviderV3) {
        this.suggestionService = suggestionService;
        this.searchServiceV2 = searchServiceV2;
        this.searchServiceV3 = searchServiceV3;
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
            return searchServiceV3.performKeywordSearch(query, category);
        } else {
            // Search all categories asynchronously
            return searchServiceV3.performKeywordSearch(query);
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

    // NEW: SSRM endpoint for individual categories
    @PostMapping("/v3/search/ssrm/{category}")
    public Map<String, Object> getSSRMDataForCategory(
            @PathVariable String category,
            @RequestBody(required = false) Map<String, Object> requestBody,
            HttpServletRequest request) {
        String loginId = request.getHeader(CITI_PORTAL_LOGIN_ID_HEADER);
        
        logger.info("SSRM request for category: {} by user: {} with body: {}", 
                category, loginId, requestBody);
        
        try {
            // Extract SSRM parameters
            String searchTerm = (String) requestBody.get("searchTerm");
            List<String> groupKeys = (List<String>) requestBody.get("groupKeys");
            String rowGroupCols = (String) requestBody.get("rowGroupCols");
            String valueCols = (String) requestBody.get("valueCols");
            String filterModel = (String) requestBody.get("filterModel");
            String sortModel = (String) requestBody.get("sortModel");
            
            // Handle group expansion
            if (groupKeys != null && !groupKeys.isEmpty()) {
                String groupKey = groupKeys.get(groupKeys.size() - 1); // Get the last group key
                SearchCategoryResult result = oracleSearchProviderV3.expandGroup(category, groupKey, searchTerm);
                
                if (result != null && result.getData() != null) {
                    return new HashMap<String, Object>() {{
                        put("success", true);
                        put("rows", result.getData());
                        put("lastRow", result.getData().size());
                    }};
                }
            } else {
                // Initial data load for category - use Elasticsearch
                Map<String, SearchCategoryResult> searchResults = searchServiceV3.performKeywordSearch(searchTerm, category);
                
                if (searchResults != null && searchResults.containsKey(category)) {
                    SearchCategoryResult result = searchResults.get(category);
                    if (result != null && result.getData() != null) {
                        return new HashMap<String, Object>() {{
                            put("success", true);
                            put("rows", result.getData());
                            put("lastRow", result.getData().size());
                        }};
                    }
                }
            }
            
            // Return empty result
            return new HashMap<String, Object>() {{
                put("success", true);
                put("rows", Collections.emptyList());
                put("lastRow", 0);
            }};
            
        } catch (Exception e) {
            logger.error("Error in SSRM request for category: {}", category, e);
            return new HashMap<String, Object>() {{
                put("success", false);
                put("error", e.getMessage());
                put("rows", Collections.emptyList());
                put("lastRow", 0);
            }};
        }
    }
}
