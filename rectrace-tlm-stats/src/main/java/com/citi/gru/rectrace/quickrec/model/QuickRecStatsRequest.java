package com.citi.gru.rectrace.quickrec.model;

/**
 * Request model for QuickRec statistics API
 */
public class QuickRecStatsRequest {
    
    private String reconId;
    private String recPortalId;
    private int dateRange = 1; // Default to 1 day
    private String entryPoint; // "recon_id" or "rec_portal_id"
    
    // Default constructor
    public QuickRecStatsRequest() {
    }
    
    // Constructor with all fields
    public QuickRecStatsRequest(String reconId, String recPortalId, int dateRange, String entryPoint) {
        this.reconId = reconId;
        this.recPortalId = recPortalId;
        this.dateRange = dateRange;
        this.entryPoint = entryPoint;
    }
    
    // Getters and Setters
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
        return "QuickRecStatsRequest{" +
                "reconId='" + reconId + '\'' +
                ", recPortalId='" + recPortalId + '\'' +
                ", dateRange=" + dateRange +
                ", entryPoint='" + entryPoint + '\'' +
                '}';
    }
}