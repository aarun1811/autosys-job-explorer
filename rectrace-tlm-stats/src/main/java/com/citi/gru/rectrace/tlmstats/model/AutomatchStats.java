package com.citi.gru.rectrace.tlmstats.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Data model for Automatch Statistics query results
 */
public class AutomatchStats {
    
    @JsonProperty("tlm_instance")
    private String tlmInstance;
    
    @JsonProperty("agent_code")
    private String agentCode;
    
    @JsonProperty("setid")
    private String setid;
    
    @JsonProperty("stmt_date")
    private String stmtDate;
    
    @JsonProperty("bran_code")
    private String branCode;
    
    @JsonProperty("corr_acc_no")
    private String corrAccNo;
    
    @JsonProperty("total_items")
    private Long totalItems;
    
    @JsonProperty("automatch_items")
    private Long automatchItems;
    
    // Default constructor
    public AutomatchStats() {}
    
    // Constructor with all fields
    public AutomatchStats(String tlmInstance, String agentCode, String setid, String stmtDate, 
                         String branCode, String corrAccNo, Long totalItems, 
                         Long automatchItems) {
        this.tlmInstance = tlmInstance;
        this.agentCode = agentCode;
        this.setid = setid;
        this.stmtDate = stmtDate;
        this.branCode = branCode;
        this.corrAccNo = corrAccNo;
        this.totalItems = totalItems;
        this.automatchItems = automatchItems;
    }
    
    // Getters and Setters
    public String getTlmInstance() {
        return tlmInstance;
    }
    
    public void setTlmInstance(String tlmInstance) {
        this.tlmInstance = tlmInstance;
    }
    
    public String getAgentCode() {
        return agentCode;
    }
    
    public void setAgentCode(String agentCode) {
        this.agentCode = agentCode;
    }
    
    public String getSetid() {
        return setid;
    }
    
    public void setSetid(String setid) {
        this.setid = setid;
    }
    
    public String getStmtDate() {
        return stmtDate;
    }
    
    public void setStmtDate(String stmtDate) {
        this.stmtDate = stmtDate;
    }
    
    public String getBranCode() {
        return branCode;
    }
    
    public void setBranCode(String branCode) {
        this.branCode = branCode;
    }
    
    public String getCorrAccNo() {
        return corrAccNo;
    }
    
    public void setCorrAccNo(String corrAccNo) {
        this.corrAccNo = corrAccNo;
    }
    
    public Long getTotalItems() {
        return totalItems;
    }
    
    public void setTotalItems(Long totalItems) {
        this.totalItems = totalItems;
    }
    
    public Long getAutomatchItems() {
        return automatchItems;
    }
    
    public void setAutomatchItems(Long automatchItems) {
        this.automatchItems = automatchItems;
    }
    
    @Override
    public String toString() {
        return "AutomatchStats{" +
                "tlmInstance='" + tlmInstance + '\'' +
                ", agentCode='" + agentCode + '\'' +
                ", setid='" + setid + '\'' +
                ", stmtDate='" + stmtDate + '\'' +
                ", branCode='" + branCode + '\'' +
                ", corrAccNo='" + corrAccNo + '\'' +
                ", totalItems=" + totalItems +
                ", automatchItems=" + automatchItems +
                '}';
    }
} 