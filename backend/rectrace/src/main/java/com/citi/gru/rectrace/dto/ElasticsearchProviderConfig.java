package com.citi.gru.rectrace.dto;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL) // Allow optional fields to be omitted in JSON/null in Java
public class ElasticsearchProviderConfig extends ProviderSpecificConfig {

    private String targetIndex;                  // Mandatory: Name of the ES index
    private List<String> queryFields;            // Mandatory: Fields in ES to query against
    private List<String> resultFields;           // Optional: Fields to retrieve from ES _source
    private Map<String, Double> relevanceBoost;  // Optional: Boost scores for queryFields
    private SortConfig defaultSort;              // Optional: Default sorting
    private String collapseOnPrecomputedField;    // Optional: Field to collapse on

    // Nested class for sorting configuration
    public static class SortConfig {
        private String field;     // Field to sort on (e.g., "_score", "fieldName.keyword")
        private String direction; // "asc" or "desc"

        // Getters and Setters for SortConfig
        public String getField() { 
            return field; 
        }

        public void setField(String field) { 
            this.field = field; 
        }

        public String getDirection() { 
            return direction; 
        }

        public void setDirection(String direction) { 
            this.direction = direction; 
        }
    }

    // Getters and Setters for ElasticsearchProviderConfig
    public String getTargetIndex() {
        return targetIndex;
    }

    public void setTargetIndex(String targetIndex) {
        this.targetIndex = targetIndex;
    }

    public List<String> getQueryFields() {
        return queryFields;
    }

    public void setQueryFields(List<String> queryFields) {
        this.queryFields = queryFields;
    }

    public List<String> getResultFields() {
        return resultFields;
    }

    public void setResultFields(List<String> resultFields) {
        this.resultFields = resultFields;
    }

    public Map<String, Double> getRelevanceBoost() {
        return relevanceBoost;
    }

    public void setRelevanceBoost(Map<String, Double> relevanceBoost) {
        this.relevanceBoost = relevanceBoost;
    }

    public SortConfig getDefaultSort() {
        return defaultSort;
    }

    public void setDefaultSort(SortConfig defaultSort) {
        this.defaultSort = defaultSort;
    }

    public String getCollapseOnPrecomputedField() {
        return collapseOnPrecomputedField;
    }

    public void setCollapseOnPrecomputedField(String collapseOnPrecomputedField) {
        this.collapseOnPrecomputedField = collapseOnPrecomputedField;
    }
}