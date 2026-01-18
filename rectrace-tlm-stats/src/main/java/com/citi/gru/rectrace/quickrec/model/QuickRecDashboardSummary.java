package com.citi.gru.rectrace.quickrec.model;

/**
 * Dashboard summary model for QuickRec statistics
 */
public class QuickRecDashboardSummary {
    
    private Long totalLeftRecords;
    private Long totalRightRecords;
    private Long totalLeftBreaks;
    private Long totalRightBreaks;
    private Long totalLeftAutoMatches;
    private Long totalRightAutoMatches;
    private Long totalLeftManualMatches;
    private Long totalRightManualMatches;
    
    // Calculated percentages
    private Double leftBreakPercentage;
    private Double rightBreakPercentage;
    private Double leftAutoMatchPercentage;
    private Double rightAutoMatchPercentage;
    private Double leftManualMatchPercentage;
    private Double rightManualMatchPercentage;
    
    // Default constructor
    public QuickRecDashboardSummary() {
        // Initialize with zeros
        this.totalLeftRecords = 0L;
        this.totalRightRecords = 0L;
        this.totalLeftBreaks = 0L;
        this.totalRightBreaks = 0L;
        this.totalLeftAutoMatches = 0L;
        this.totalRightAutoMatches = 0L;
        this.totalLeftManualMatches = 0L;
        this.totalRightManualMatches = 0L;
        calculatePercentages();
    }
    
    // Constructor with main values (percentages will be calculated)
    public QuickRecDashboardSummary(Long totalLeftRecords, Long totalRightRecords,
                                    Long totalLeftBreaks, Long totalRightBreaks,
                                    Long totalLeftAutoMatches, Long totalRightAutoMatches,
                                    Long totalLeftManualMatches, Long totalRightManualMatches) {
        this.totalLeftRecords = totalLeftRecords != null ? totalLeftRecords : 0L;
        this.totalRightRecords = totalRightRecords != null ? totalRightRecords : 0L;
        this.totalLeftBreaks = totalLeftBreaks != null ? totalLeftBreaks : 0L;
        this.totalRightBreaks = totalRightBreaks != null ? totalRightBreaks : 0L;
        this.totalLeftAutoMatches = totalLeftAutoMatches != null ? totalLeftAutoMatches : 0L;
        this.totalRightAutoMatches = totalRightAutoMatches != null ? totalRightAutoMatches : 0L;
        this.totalLeftManualMatches = totalLeftManualMatches != null ? totalLeftManualMatches : 0L;
        this.totalRightManualMatches = totalRightManualMatches != null ? totalRightManualMatches : 0L;
        calculatePercentages();
    }
    
    // Calculate percentages based on totals
    public void calculatePercentages() {
        // Left side percentages
        if (totalLeftRecords > 0) {
            leftBreakPercentage = (totalLeftBreaks.doubleValue() / totalLeftRecords.doubleValue()) * 100;
            leftAutoMatchPercentage = (totalLeftAutoMatches.doubleValue() / totalLeftRecords.doubleValue()) * 100;
            leftManualMatchPercentage = (totalLeftManualMatches.doubleValue() / totalLeftRecords.doubleValue()) * 100;
        } else {
            leftBreakPercentage = 0.0;
            leftAutoMatchPercentage = 0.0;
            leftManualMatchPercentage = 0.0;
        }
        
        // Right side percentages
        if (totalRightRecords > 0) {
            rightBreakPercentage = (totalRightBreaks.doubleValue() / totalRightRecords.doubleValue()) * 100;
            rightAutoMatchPercentage = (totalRightAutoMatches.doubleValue() / totalRightRecords.doubleValue()) * 100;
            rightManualMatchPercentage = (totalRightManualMatches.doubleValue() / totalRightRecords.doubleValue()) * 100;
        } else {
            rightBreakPercentage = 0.0;
            rightAutoMatchPercentage = 0.0;
            rightManualMatchPercentage = 0.0;
        }
    }
    
    // Getters and Setters
    public Long getTotalLeftRecords() {
        return totalLeftRecords;
    }
    
    public void setTotalLeftRecords(Long totalLeftRecords) {
        this.totalLeftRecords = totalLeftRecords;
    }
    
    public Long getTotalRightRecords() {
        return totalRightRecords;
    }
    
    public void setTotalRightRecords(Long totalRightRecords) {
        this.totalRightRecords = totalRightRecords;
    }
    
    public Long getTotalLeftBreaks() {
        return totalLeftBreaks;
    }
    
    public void setTotalLeftBreaks(Long totalLeftBreaks) {
        this.totalLeftBreaks = totalLeftBreaks;
    }
    
    public Long getTotalRightBreaks() {
        return totalRightBreaks;
    }
    
    public void setTotalRightBreaks(Long totalRightBreaks) {
        this.totalRightBreaks = totalRightBreaks;
    }
    
    public Long getTotalLeftAutoMatches() {
        return totalLeftAutoMatches;
    }
    
    public void setTotalLeftAutoMatches(Long totalLeftAutoMatches) {
        this.totalLeftAutoMatches = totalLeftAutoMatches;
    }
    
    public Long getTotalRightAutoMatches() {
        return totalRightAutoMatches;
    }
    
    public void setTotalRightAutoMatches(Long totalRightAutoMatches) {
        this.totalRightAutoMatches = totalRightAutoMatches;
    }
    
    public Long getTotalLeftManualMatches() {
        return totalLeftManualMatches;
    }
    
    public void setTotalLeftManualMatches(Long totalLeftManualMatches) {
        this.totalLeftManualMatches = totalLeftManualMatches;
    }
    
    public Long getTotalRightManualMatches() {
        return totalRightManualMatches;
    }
    
    public void setTotalRightManualMatches(Long totalRightManualMatches) {
        this.totalRightManualMatches = totalRightManualMatches;
    }
    
    public Double getLeftBreakPercentage() {
        return leftBreakPercentage;
    }
    
    public void setLeftBreakPercentage(Double leftBreakPercentage) {
        this.leftBreakPercentage = leftBreakPercentage;
    }
    
    public Double getRightBreakPercentage() {
        return rightBreakPercentage;
    }
    
    public void setRightBreakPercentage(Double rightBreakPercentage) {
        this.rightBreakPercentage = rightBreakPercentage;
    }
    
    public Double getLeftAutoMatchPercentage() {
        return leftAutoMatchPercentage;
    }
    
    public void setLeftAutoMatchPercentage(Double leftAutoMatchPercentage) {
        this.leftAutoMatchPercentage = leftAutoMatchPercentage;
    }
    
    public Double getRightAutoMatchPercentage() {
        return rightAutoMatchPercentage;
    }
    
    public void setRightAutoMatchPercentage(Double rightAutoMatchPercentage) {
        this.rightAutoMatchPercentage = rightAutoMatchPercentage;
    }
    
    public Double getLeftManualMatchPercentage() {
        return leftManualMatchPercentage;
    }
    
    public void setLeftManualMatchPercentage(Double leftManualMatchPercentage) {
        this.leftManualMatchPercentage = leftManualMatchPercentage;
    }
    
    public Double getRightManualMatchPercentage() {
        return rightManualMatchPercentage;
    }
    
    public void setRightManualMatchPercentage(Double rightManualMatchPercentage) {
        this.rightManualMatchPercentage = rightManualMatchPercentage;
    }
}