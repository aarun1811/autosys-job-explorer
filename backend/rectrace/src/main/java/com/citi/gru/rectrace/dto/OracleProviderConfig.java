package com.citi.gru.rectrace.dto;

import java.util.Map;

// No need for @JsonInclude here unless fields can be null in config
public class OracleProviderConfig extends ProviderSpecificConfig {
    private String query;          // The native SQL query
    private String parameterName;  // The name of the parameter in the query (legacy)
    private Map<String, String> parameters;  // New parameter mapping structure
    private String[] resultFields; // Fields to return in the result

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

    public Map<String, String> getParameters() {
        return parameters;
    }

    public void setParameters(Map<String, String> parameters) {
        this.parameters = parameters;
    }

    public String[] getResultFields() {
        return resultFields;
    }

    public void setResultFields(String[] resultFields) {
        this.resultFields = resultFields;
    }
}