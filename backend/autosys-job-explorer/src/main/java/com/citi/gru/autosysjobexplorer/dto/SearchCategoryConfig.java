package com.citi.gru.autosysjobexplorer.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class SearchCategoryConfig {
    private String key;
    private String label;
    private List<SearchColumnDefinition> columns;

    // Getters and Setters

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public List<SearchColumnDefinition> getColumns() {
        return columns;
    }

    public void setColumns(List<SearchColumnDefinition> columns) {
        this.columns = columns;
    }
}