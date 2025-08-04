package com.citi.gru.rectrace.tlmstats.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Data model for Manual Match Statistics query results
 */
public class ManualMatchStats {
    
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
    
    @JsonProperty("total_manual_match_count")
    private Long totalManualMatchCount;
    
    // Default constructor
    public ManualMatchStats() {}
    
    // Constructor with all fields
    public ManualMatchStats(String tlmInstance, String agentCode, String setid, String stmtDate, 
                           String branCode, String corrAccNo, Long totalManualMatchCount) {
        this.tlmInstance = tlmInstance;
        this.agentCode = agentCode;
        this.setid = setid;
        this.stmtDate = stmtDate;
        this.branCode = branCode;
        this.corrAccNo = corrAccNo;
        this.totalManualMatchCount = totalManualMatchCount;
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
    
    public Long getTotalManualMatchCount() {
        return totalManualMatchCount;
    }
    
    public void setTotalManualMatchCount(Long totalManualMatchCount) {
        this.totalManualMatchCount = totalManualMatchCount;
    }
    
    @Override
    public String toString() {
        return "ManualMatchStats{" +
                "tlmInstance='" + tlmInstance + '\'' +
                ", agentCode='" + agentCode + '\'' +
                ", setid='" + setid + '\'' +
                ", stmtDate='" + stmtDate + '\'' +
                ", branCode='" + branCode + '\'' +
                ", corrAccNo='" + corrAccNo + '\'' +
                ", totalManualMatchCount=" + totalManualMatchCount +
                '}';
    }
} 