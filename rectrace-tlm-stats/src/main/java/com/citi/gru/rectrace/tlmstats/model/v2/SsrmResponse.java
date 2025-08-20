package com.citi.gru.rectrace.tlmstats.model.v2;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Server-Side Row Model response for TLM Stats V2
 */
public class SsrmResponse<T> {
    
    @JsonProperty("data")
    private List<T> data;
    
    @JsonProperty("lastRow")
    private Integer lastRow;
    
    @JsonProperty("status")
    private String status = "success";
    
    @JsonProperty("count")
    private int count;
    
    // Default constructor
    public SsrmResponse() {}
    
    // Constructor with data and total count
    public SsrmResponse(List<T> data, int totalRows) {
        this.data = data;
        this.count = data.size();
        this.lastRow = totalRows; // Set lastRow to total number of rows available
        this.status = "success";
    }
    
    // Constructor for when there are no more rows (end of data)
    public SsrmResponse(List<T> data, int totalRows, boolean isLastPage) {
        this.data = data;
        this.count = data.size();
        this.status = "success";
        
        if (isLastPage) {
            // When it's the last page, lastRow should be set to indicate end of data
            this.lastRow = totalRows;
        } else {
            // When there are more pages, lastRow should be null or -1
            this.lastRow = null;
        }
    }
    
    // Getters and Setters
    public List<T> getData() {
        return data;
    }
    
    public void setData(List<T> data) {
        this.data = data;
        if (data != null) {
            this.count = data.size();
        }
    }
    
    public Integer getLastRow() {
        return lastRow;
    }
    
    public void setLastRow(Integer lastRow) {
        this.lastRow = lastRow;
    }
    
    public String getStatus() {
        return status;
    }
    
    public void setStatus(String status) {
        this.status = status;
    }
    
    public int getCount() {
        return count;
    }
    
    public void setCount(int count) {
        this.count = count;
    }
    
    @Override
    public String toString() {
        return "SsrmResponse{" +
                "data=" + (data != null ? data.size() + " items" : "null") +
                ", lastRow=" + lastRow +
                ", status='" + status + '\'' +
                ", count=" + count +
                '}';
    }
}