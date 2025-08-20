package com.citi.gru.rectrace.controller;

import java.util.*;
import javax.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;
import com.citi.gru.rectrace.dto.SearchCategoryResult;
import com.citi.gru.rectrace.service.SuggestionService;
import com.citi.gru.rectrace.service.v3.OracleSearchProviderV3;
import com.citi.gru.rectrace.service.v3.SearchServiceV3;

@RestController
@RequestMapping("/api")
public class SearchController {

    private static final Logger logger = LoggerFactory.getLogger(SearchController.class);

    private static final String CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid";

    private final SuggestionService suggestionService;

    private final SearchServiceV3 searchServiceV3;
    private final OracleSearchProviderV3 oracleSearchProviderV3;

    public SearchController(
            SuggestionService suggestionService,
            SearchServiceV3 searchServiceV3,
            OracleSearchProviderV3 oracleSearchProviderV3) {
        this.suggestionService = suggestionService;
        this.searchServiceV3 = searchServiceV3;
        this.oracleSearchProviderV3 = oracleSearchProviderV3;
    }

    @GetMapping("/search/suggest")
    public List<String> suggest(@RequestParam(name = "prefix") String prefix) {
        return suggestionService.getCombinedSuggestions(prefix);
    }

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
            // Search all categories (simplified - just return first valid category for now)
            // In a full implementation, this would search all categories
            logger.warn("V3 Keyword Search: No category specified, returning empty result");
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

        SearchCategoryResult result = oracleSearchProviderV3.expandGroup(category, groupKey, query, null);
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
            List<String> visibleColumns = (List<String>) requestBody.get("visibleColumns");
            Boolean deduplicate = (Boolean) requestBody.get("deduplicated");
            // Delegate to service layer
            return searchServiceV3.getSSRMDataForCategory(category, searchTerm, groupKeys, visibleColumns, deduplicate);

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
