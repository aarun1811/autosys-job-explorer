package com.citi.gru.rectrace.tlmstats.model.v2;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Server-Side Row Model request for TLM Stats V2
 */
public class SsrmRequest {
    
    @JsonProperty("startRow")
    private int startRow;
    
    @JsonProperty("endRow")
    private int endRow;
    
    @JsonProperty("rowGroupCols")
    private List<Map<String, Object>> rowGroupCols;
    
    @JsonProperty("valueCols")
    private List<Map<String, Object>> valueCols;
    
    @JsonProperty("pivotCols")
    private List<Map<String, Object>> pivotCols;
    
    @JsonProperty("pivotMode")
    private boolean pivotMode;
    
    @JsonProperty("groupKeys")
    private List<String> groupKeys;
    
    @JsonProperty("filterModel")
    private Map<String, Object> filterModel;
    
    @JsonProperty("sortModel")
    private List<Map<String, Object>> sortModel;
    
    // Custom filter parameters
    @JsonProperty("tlm_instance")
    private String tlmInstance;
    
    @JsonProperty("agent_codes")
    private List<String> agentCodes;
    
    @JsonProperty("set_ids")
    private List<String> setIds;
    
    @JsonProperty("date_range")
    private int dateRange = 1; // Default to 1 day
    
    // Default constructor
    public SsrmRequest() {}
    
    // Constructor with pagination
    public SsrmRequest(int startRow, int endRow) {
        this.startRow = startRow;
        this.endRow = endRow;
    }
    
    // Getters and Setters
    public int getStartRow() {
        return startRow;
    }
    
    public void setStartRow(int startRow) {
        this.startRow = startRow;
    }
    
    public int getEndRow() {
        return endRow;
    }
    
    public void setEndRow(int endRow) {
        this.endRow = endRow;
    }
    
    public List<Map<String, Object>> getRowGroupCols() {
        return rowGroupCols;
    }
    
    public void setRowGroupCols(List<Map<String, Object>> rowGroupCols) {
        this.rowGroupCols = rowGroupCols;
    }
    
    public List<Map<String, Object>> getValueCols() {
        return valueCols;
    }
    
    public void setValueCols(List<Map<String, Object>> valueCols) {
        this.valueCols = valueCols;
    }
    
    public List<Map<String, Object>> getPivotCols() {
        return pivotCols;
    }
    
    public void setPivotCols(List<Map<String, Object>> pivotCols) {
        this.pivotCols = pivotCols;
    }
    
    public boolean isPivotMode() {
        return pivotMode;
    }
    
    public void setPivotMode(boolean pivotMode) {
        this.pivotMode = pivotMode;
    }
    
    public List<String> getGroupKeys() {
        return groupKeys;
    }
    
    public void setGroupKeys(List<String> groupKeys) {
        this.groupKeys = groupKeys;
    }
    
    public Map<String, Object> getFilterModel() {
        return filterModel;
    }
    
    public void setFilterModel(Map<String, Object> filterModel) {
        this.filterModel = filterModel;
    }
    
    public List<Map<String, Object>> getSortModel() {
        return sortModel;
    }
    
    public void setSortModel(List<Map<String, Object>> sortModel) {
        this.sortModel = sortModel;
    }
    
    public String getTlmInstance() {
        return tlmInstance;
    }
    
    public void setTlmInstance(String tlmInstance) {
        this.tlmInstance = tlmInstance;
    }
    
    public List<String> getAgentCodes() {
        return agentCodes;
    }
    
    public void setAgentCodes(List<String> agentCodes) {
        this.agentCodes = agentCodes;
    }
    
    public List<String> getSetIds() {
        return setIds;
    }
    
    public void setSetIds(List<String> setIds) {
        this.setIds = setIds;
    }
    
    public int getDateRange() {
        return dateRange;
    }
    
    public void setDateRange(int dateRange) {
        this.dateRange = dateRange;
    }
    
    @Override
    public String toString() {
        return "SsrmRequest{" +
                "startRow=" + startRow +
                ", endRow=" + endRow +
                ", tlmInstance='" + tlmInstance + '\'' +
                ", agentCodes=" + agentCodes +
                ", setIds=" + setIds +
                ", dateRange=" + dateRange +
                ", filterModel=" + filterModel +
                ", sortModel=" + sortModel +
                '}';
    }
}