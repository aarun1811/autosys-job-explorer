package com.citi.gru.rectrace.quickrec.model;

/**
 * Model class for QuickRec auto-match statistics from reconmgmt database
 */
public class QuickRecAutoMatchStats {
    
    private String reconName;
    private String reconId;
    private String recPortalId;
    private Long leftRecordCount;
    private Long rightRecordCount;
    private Long leftBreakCount;
    private Long rightBreakCount;
    private Long leftMatchCount;
    private Long rightMatchCount;
    private String loadDate;
    
    // Default constructor
    public QuickRecAutoMatchStats() {
    }
    
    // Constructor with all fields
    public QuickRecAutoMatchStats(String reconName, String reconId, String recPortalId,
                                  Long leftRecordCount, Long rightRecordCount,
                                  Long leftBreakCount, Long rightBreakCount,
                                  Long leftMatchCount, Long rightMatchCount,
                                  String loadDate) {
        this.reconName = reconName;
        this.reconId = reconId;
        this.recPortalId = recPortalId;
        this.leftRecordCount = leftRecordCount;
        this.rightRecordCount = rightRecordCount;
        this.leftBreakCount = leftBreakCount;
        this.rightBreakCount = rightBreakCount;
        this.leftMatchCount = leftMatchCount;
        this.rightMatchCount = rightMatchCount;
        this.loadDate = loadDate;
    }
    
    // Getters and Setters
    public String getReconName() {
        return reconName;
    }
    
    public void setReconName(String reconName) {
        this.reconName = reconName;
    }
    
    public String getReconId() {
        return reconId;
    }
    
    public void setReconId(String reconId) {
        this.reconId = reconId;
    }
    
    public String getRecPortalId() {
        return recPortalId;
    }
    
    public void setRecPortalId(String recPortalId) {
        this.recPortalId = recPortalId;
    }
    
    public Long getLeftRecordCount() {
        return leftRecordCount;
    }
    
    public void setLeftRecordCount(Long leftRecordCount) {
        this.leftRecordCount = leftRecordCount;
    }
    
    public Long getRightRecordCount() {
        return rightRecordCount;
    }
    
    public void setRightRecordCount(Long rightRecordCount) {
        this.rightRecordCount = rightRecordCount;
    }
    
    public Long getLeftBreakCount() {
        return leftBreakCount;
    }
    
    public void setLeftBreakCount(Long leftBreakCount) {
        this.leftBreakCount = leftBreakCount;
    }
    
    public Long getRightBreakCount() {
        return rightBreakCount;
    }
    
    public void setRightBreakCount(Long rightBreakCount) {
        this.rightBreakCount = rightBreakCount;
    }
    
    public Long getLeftMatchCount() {
        return leftMatchCount;
    }
    
    public void setLeftMatchCount(Long leftMatchCount) {
        this.leftMatchCount = leftMatchCount;
    }
    
    public Long getRightMatchCount() {
        return rightMatchCount;
    }
    
    public void setRightMatchCount(Long rightMatchCount) {
        this.rightMatchCount = rightMatchCount;
    }
    
    public String getLoadDate() {
        return loadDate;
    }
    
    public void setLoadDate(String loadDate) {
        this.loadDate = loadDate;
    }
    
    @Override
    public String toString() {
        return "QuickRecAutoMatchStats{" +
                "reconName='" + reconName + '\'' +
                ", reconId='" + reconId + '\'' +
                ", recPortalId='" + recPortalId + '\'' +
                ", leftRecordCount=" + leftRecordCount +
                ", rightRecordCount=" + rightRecordCount +
                ", leftBreakCount=" + leftBreakCount +
                ", rightBreakCount=" + rightBreakCount +
                ", leftMatchCount=" + leftMatchCount +
                ", rightMatchCount=" + rightMatchCount +
                ", loadDate='" + loadDate + '\'' +
                '}';
    }
}