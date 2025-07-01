package com.citi.gru.rectrace.dto;

import java.util.List;

public class SearchConfiguration {
    private List<SearchCategoryDefinition> searchCategories;

    // Getter and Setter
    public List<SearchCategoryDefinition> getSearchCategories() {
        return searchCategories;
    }

    public void setSearchCategories(List<SearchCategoryDefinition> searchCategories) {
        this.searchCategories = searchCategories;
    }
}