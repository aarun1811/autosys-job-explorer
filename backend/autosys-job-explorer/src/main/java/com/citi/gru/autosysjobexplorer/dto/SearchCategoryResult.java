package com.citi.gru.autosysjobexplorer.dto;

import java.util.List;
import java.util.Map;

public class SearchCategoryResult {
    private SearchCategoryConfig config;
    private List<Map<String, Object>> data;

    // Constructor, Getters and Setters

    public SearchCategoryResult(SearchCategoryConfig config, List<Map<String, Object>> data) {
        this.config = config;
        this.data = data;
    }

    public SearchCategoryConfig getConfig() {
        return config;
    }

    public void setConfig(SearchCategoryConfig config) {
        this.config = config;
    }

    public List<Map<String, Object>> getData() {
        return data;
    }

    public void setData(List<Map<String, Object>> data) {
        this.data = data;
    }
}