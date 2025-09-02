package com.citi.gru.rectrace.tlmstats.model.v2;

import java.util.List;

/**
 * Simple request model for TLM Stats API without SSRM complexity
 */
public class TlmStatsRequest {
    
    private String tlmInstance;
    private List<String> agentCodes;
    private List<String> setIds;
    private int dateRange = 1; // Default to 1 day
    private String entryPoint; // "set_id", "recon", or "tlm_instance"
    
    // Constructors
    public TlmStatsRequest() {
    }
    
    public TlmStatsRequest(String tlmInstance, List<String> agentCodes, List<String> setIds, int dateRange) {
        this.tlmInstance = tlmInstance;
        this.agentCodes = agentCodes;
        this.setIds = setIds;
        this.dateRange = dateRange;
    }
    
    public TlmStatsRequest(String tlmInstance, List<String> agentCodes, List<String> setIds, int dateRange, String entryPoint) {
        this.tlmInstance = tlmInstance;
        this.agentCodes = agentCodes;
        this.setIds = setIds;
        this.dateRange = dateRange;
        this.entryPoint = entryPoint;
    }
    
    // Getters and Setters
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
    
    public String getEntryPoint() {
        return entryPoint;
    }
    
    public void setEntryPoint(String entryPoint) {
        this.entryPoint = entryPoint;
    }
    
    @Override
    public String toString() {
        return "TlmStatsRequest{" +
                "tlmInstance='" + tlmInstance + '\'' +
                ", agentCodes=" + agentCodes +
                ", setIds=" + setIds +
                ", dateRange=" + dateRange +
                ", entryPoint='" + entryPoint + '\'' +
                '}';
    }
}