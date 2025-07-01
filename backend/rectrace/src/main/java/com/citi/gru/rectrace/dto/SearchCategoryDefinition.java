package com.citi.gru.rectrace.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class SearchCategoryDefinition {
    private String key;
    private String label;
    private List<SearchColumnDefinition> columns;
    private String searchProviderType; // Now mandatory to determine which provider config applies

    // Replaced 'query' and 'parameterName' with this polymorphic field
    @JsonTypeInfo(
            use = JsonTypeInfo.Id.NAME,
            include = JsonTypeInfo.As.EXTERNAL_PROPERTY, // Uses the value of 'searchProviderType' sibling property
            property = "searchProviderType"              // The property containing the type name ("oracle", "elasticsearch")
    )
    @JsonSubTypes({
            @JsonSubTypes.Type(value = OracleProviderConfig.class, name = "oracle"),
            @JsonSubTypes.Type(value = ElasticsearchProviderConfig.class, name = "elasticsearch")
            // Add future types here, e.g.: @JsonSubTypes.Type(value = HiveProviderConfig.class, name = "hive")
    })
    private ProviderSpecificConfig providerConfig; // Holds the actual config object

    @JsonIgnore // Internal flag, not part of the JSON file itself
    private boolean valid = true; // Assume valid initially

    // --- Getters and Setters ---

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

    // Removed getQuery/setQuery
    // Removed getParameterName/setParameterName

    public List<SearchColumnDefinition> getColumns() {
        return columns;
    }

    public void setColumns(List<SearchColumnDefinition> columns) {
        this.columns = columns;
    }

    public String getSearchProviderType() {
        return searchProviderType;
    }

    public void setSearchProviderType(String searchProviderType) {
        this.searchProviderType = searchProviderType;
    }

    public ProviderSpecificConfig getProviderConfig() {
        return providerConfig;
    }

    public void setProviderConfig(ProviderSpecificConfig providerConfig) {
        this.providerConfig = providerConfig;
    }

    // --- Internal validation flag ---

    @JsonIgnore
    public boolean isValid() {
        return valid;
    }

    @JsonIgnore
    public void setValid(boolean valid) {
        this.valid = valid;
    }
}