package com.citi.gru.autosysjobexplorer.service;

import com.citi.gru.autosysjobexplorer.dto.SearchCategoryDefinition; // Uses the full config DTO
import com.citi.gru.autosysjobexplorer.dto.SearchCategoryResult;     // Returns the result DTO

/**
 * Interface for different search backend implementations (e.g., Oracle, Elasticsearch).
 */
public interface SearchProvider {

    /**
     * Performs a search based on the given full category definition and search term.
     *
     * @param categoryDefinition The full configuration for the specific search category.
     * @param searchTerm The user-provided search term.
     * @return A SearchCategoryResult containing the search results (data) and the
     * minimal configuration (SearchCategoryConfig) needed by the frontend,
     * or null if the search could not be performed for this provider.
     */
    SearchCategoryResult search(SearchCategoryDefinition categoryDefinition, String searchTerm);

    /**
     * Returns the type identifier for this provider (e.g., "oracle", "elasticsearch").
     * This should match the 'searchProviderType' value used in search-config.json.
     *
     * @return The provider type string.
     */
    String getProviderType();
}