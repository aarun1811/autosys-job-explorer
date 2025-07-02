package com.citi.gru.rectrace.dto;

// No need for @JsonInclude here unless fields can be null in config
public class OracleProviderConfig extends ProviderSpecificConfig {
    private String query;          // The native SQL query
    private String parameterName;  // The name of the parameter in the query

    // Getters and Setters
    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public String getParameterName() {
        return parameterName;
    }

    public void setParameterName(String parameterName) {
        this.parameterName = parameterName;
    }
}