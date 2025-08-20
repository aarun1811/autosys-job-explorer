package com.citi.gru.rectrace.tlmstats.model.v2;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Merged reconciliation statistics for TLM Stats V2
 * Combines automatch and manual match data
 */
public class MergedReconStats {
    
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
    
    @JsonProperty("total_manual_match_count")
    private Long totalManualMatchCount;
    
    // Default constructor
    public MergedReconStats() {}
    
    // Constructor with all fields
    public MergedReconStats(String tlmInstance, String agentCode, String setid, String stmtDate,
                           String branCode, String corrAccNo, Long totalItems, 
                           Long automatchItems, Long totalManualMatchCount) {
        this.tlmInstance = tlmInstance;
        this.agentCode = agentCode;
        this.setid = setid;
        this.stmtDate = stmtDate;
        this.branCode = branCode;
        this.corrAccNo = corrAccNo;
        this.totalItems = totalItems;
        this.automatchItems = automatchItems;
        this.totalManualMatchCount = totalManualMatchCount;
    }
    
    // Create unique key for merging data
    public String getMergeKey() {
        return String.format("%s_%s_%s_%s_%s_%s", 
                            tlmInstance != null ? tlmInstance : "", 
                            agentCode != null ? agentCode : "", 
                            setid != null ? setid : "", 
                            stmtDate != null ? stmtDate : "", 
                            branCode != null ? branCode : "", 
                            corrAccNo != null ? corrAccNo : "");
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
    
    public Long getTotalManualMatchCount() {
        return totalManualMatchCount;
    }
    
    public void setTotalManualMatchCount(Long totalManualMatchCount) {
        this.totalManualMatchCount = totalManualMatchCount;
    }
    
    @Override
    public String toString() {
        return "MergedReconStats{" +
                "tlmInstance='" + tlmInstance + '\'' +
                ", agentCode='" + agentCode + '\'' +
                ", setid='" + setid + '\'' +
                ", stmtDate='" + stmtDate + '\'' +
                ", branCode='" + branCode + '\'' +
                ", corrAccNo='" + corrAccNo + '\'' +
                ", totalItems=" + totalItems +
                ", automatchItems=" + automatchItems +
                ", totalManualMatchCount=" + totalManualMatchCount +
                '}';
    }
}