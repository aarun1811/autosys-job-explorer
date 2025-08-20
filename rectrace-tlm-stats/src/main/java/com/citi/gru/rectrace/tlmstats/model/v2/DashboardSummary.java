package com.citi.gru.rectrace.tlmstats.model.v2;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Summary statistics for TLM Stats Dashboard V2
 */
public class DashboardSummary {
    
    @JsonProperty("total_breaks")
    private long totalBreaks;
    
    @JsonProperty("total_automatch_items")
    private long totalAutomatchItems;
    
    @JsonProperty("total_manual_match_items")
    private long totalManualMatchItems;
    
    @JsonProperty("total_items")
    private long totalItems;
    
    @JsonProperty("breaks_percentage")
    private double breaksPercentage;
    
    @JsonProperty("automatch_percentage")
    private double automatchPercentage;
    
    @JsonProperty("manual_match_percentage")
    private double manualMatchPercentage;
    
    // Default constructor
    public DashboardSummary() {}
    
    // Constructor with calculations
    public DashboardSummary(long totalBreaks, long totalAutomatchItems, long totalManualMatchItems) {
        this.totalBreaks = totalBreaks;
        this.totalAutomatchItems = totalAutomatchItems;
        this.totalManualMatchItems = totalManualMatchItems;
        this.totalItems = totalBreaks + totalAutomatchItems + totalManualMatchItems;
        
        if (this.totalItems > 0) {
            this.breaksPercentage = Math.round(((double) totalBreaks / totalItems) * 10000.0) / 100.0;
            this.automatchPercentage = Math.round(((double) totalAutomatchItems / totalItems) * 10000.0) / 100.0;
            this.manualMatchPercentage = Math.round(((double) totalManualMatchItems / totalItems) * 10000.0) / 100.0;
        } else {
            this.breaksPercentage = 0.0;
            this.automatchPercentage = 0.0;
            this.manualMatchPercentage = 0.0;
        }
    }
    
    // Getters and Setters
    public long getTotalBreaks() {
        return totalBreaks;
    }
    
    public void setTotalBreaks(long totalBreaks) {
        this.totalBreaks = totalBreaks;
    }
    
    public long getTotalAutomatchItems() {
        return totalAutomatchItems;
    }
    
    public void setTotalAutomatchItems(long totalAutomatchItems) {
        this.totalAutomatchItems = totalAutomatchItems;
    }
    
    public long getTotalManualMatchItems() {
        return totalManualMatchItems;
    }
    
    public void setTotalManualMatchItems(long totalManualMatchItems) {
        this.totalManualMatchItems = totalManualMatchItems;
    }
    
    public long getTotalItems() {
        return totalItems;
    }
    
    public void setTotalItems(long totalItems) {
        this.totalItems = totalItems;
    }
    
    public double getBreaksPercentage() {
        return breaksPercentage;
    }
    
    public void setBreaksPercentage(double breaksPercentage) {
        this.breaksPercentage = breaksPercentage;
    }
    
    public double getAutomatchPercentage() {
        return automatchPercentage;
    }
    
    public void setAutomatchPercentage(double automatchPercentage) {
        this.automatchPercentage = automatchPercentage;
    }
    
    public double getManualMatchPercentage() {
        return manualMatchPercentage;
    }
    
    public void setManualMatchPercentage(double manualMatchPercentage) {
        this.manualMatchPercentage = manualMatchPercentage;
    }
    
    @Override
    public String toString() {
        return "DashboardSummary{" +
                "totalBreaks=" + totalBreaks +
                ", totalAutomatchItems=" + totalAutomatchItems +
                ", totalManualMatchItems=" + totalManualMatchItems +
                ", totalItems=" + totalItems +
                ", breaksPercentage=" + breaksPercentage +
                ", automatchPercentage=" + automatchPercentage +
                ", manualMatchPercentage=" + manualMatchPercentage +
                '}';
    }
}