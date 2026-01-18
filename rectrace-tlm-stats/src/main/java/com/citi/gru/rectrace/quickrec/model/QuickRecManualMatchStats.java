package com.citi.gru.rectrace.quickrec.model;

/**
 * Model class for QuickRec manual match statistics from recportal database
 */
public class QuickRecManualMatchStats {
    
    private String recPortalId;
    private String cob;
    private String updatedDate;
    private Long leftManualMatches;
    private Long rightManualMatches;
    
    // Default constructor
    public QuickRecManualMatchStats() {
    }
    
    // Constructor with all fields
    public QuickRecManualMatchStats(String recPortalId, String cob, String updatedDate,
                                    Long leftManualMatches, Long rightManualMatches) {
        this.recPortalId = recPortalId;
        this.cob = cob;
        this.updatedDate = updatedDate;
        this.leftManualMatches = leftManualMatches;
        this.rightManualMatches = rightManualMatches;
    }
    
    // Getters and Setters
    public String getRecPortalId() {
        return recPortalId;
    }
    
    public void setRecPortalId(String recPortalId) {
        this.recPortalId = recPortalId;
    }
    
    public String getCob() {
        return cob;
    }
    
    public void setCob(String cob) {
        this.cob = cob;
    }
    
    public String getUpdatedDate() {
        return updatedDate;
    }
    
    public void setUpdatedDate(String updatedDate) {
        this.updatedDate = updatedDate;
    }
    
    public Long getLeftManualMatches() {
        return leftManualMatches;
    }
    
    public void setLeftManualMatches(Long leftManualMatches) {
        this.leftManualMatches = leftManualMatches;
    }
    
    public Long getRightManualMatches() {
        return rightManualMatches;
    }
    
    public void setRightManualMatches(Long rightManualMatches) {
        this.rightManualMatches = rightManualMatches;
    }
    
    @Override
    public String toString() {
        return "QuickRecManualMatchStats{" +
                "recPortalId='" + recPortalId + '\'' +
                ", cob='" + cob + '\'' +
                ", updatedDate='" + updatedDate + '\'' +
                ", leftManualMatches=" + leftManualMatches +
                ", rightManualMatches=" + rightManualMatches +
                '}';
    }
}