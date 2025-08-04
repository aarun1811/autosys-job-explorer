package com.citi.gru.rectrace.tlmstats.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Data model for Break Statistics query results
 */
public class BreakStats {
    
    @JsonProperty("count")
    private Long count;
    
    @JsonProperty("agent_code")
    private String agentCode;
    
    @JsonProperty("local_acc_no")
    private String localAccNo;
    
    @JsonProperty("bran_code")
    private String branCode;
    
    // Default constructor
    public BreakStats() {}
    
    // Constructor with all fields
    public BreakStats(Long count, String agentCode, String localAccNo, String branCode) {
        this.count = count;
        this.agentCode = agentCode;
        this.localAccNo = localAccNo;
        this.branCode = branCode;
    }
    
    // Getters and Setters
    public Long getCount() {
        return count;
    }
    
    public void setCount(Long count) {
        this.count = count;
    }
    
    public String getAgentCode() {
        return agentCode;
    }
    
    public void setAgentCode(String agentCode) {
        this.agentCode = agentCode;
    }
    
    public String getLocalAccNo() {
        return localAccNo;
    }
    
    public void setLocalAccNo(String localAccNo) {
        this.localAccNo = localAccNo;
    }
    
    public String getBranCode() {
        return branCode;
    }
    
    public void setBranCode(String branCode) {
        this.branCode = branCode;
    }
    
    @Override
    public String toString() {
        return "BreakStats{" +
                "count=" + count +
                ", agentCode='" + agentCode + '\'' +
                ", localAccNo='" + localAccNo + '\'' +
                ", branCode='" + branCode + '\'' +
                '}';
    }
} 