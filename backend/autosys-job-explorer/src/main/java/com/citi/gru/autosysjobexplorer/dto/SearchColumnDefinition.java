package com.citi.gru.autosysjobexplorer.dto;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL) // Exclude null fields from JSON output
public class SearchColumnDefinition {
    private String field;
    private String headerName;
    private Boolean sortable = true; // Default to true as per AG-Grid defaultColDef
    private String sort; 
    private Boolean filter = true;   // Default to true
    private Boolean rowGroup = false; // Default to false
    private Boolean hide = false;     // Default to false
    private String cellRenderer; // Name of the Angular component for rendering
    private Map<String, String> cellRendererParams; // Parameters for the cell renderer
    private Integer width; // Width of the column
    private Boolean resizable = true; // Default to true
    private String pinned; // Default to false
    private Map<String, String> cellStyle; // CSS styles for the cell

    // Getters and Setters

    public String getField() {
        return field;
    }

    public void setField(String field) {
        this.field = field;
    }

    public String getHeaderName() {
        return headerName;
    }

    public void setHeaderName(String headerName) {
        this.headerName = headerName;
    }

    public Boolean getSortable() {
        return sortable;
    }

    public void setSortable(Boolean sortable) {
        this.sortable = sortable;
    }

    public Boolean getFilter() {
        return filter;
    }

    public void setFilter(Boolean filter) {
        this.filter = filter;
    }

    public Boolean getRowGroup() {
        return rowGroup;
    }

    public void setRowGroup(Boolean rowGroup) {
        this.rowGroup = rowGroup;
    }

    public Boolean getHide() {
        return hide;
    }

    public void setHide(Boolean hide) {
        this.hide = hide;
    }

    public String getCellRenderer() {
        return cellRenderer;
    }

    public void setCellRenderer(String cellRenderer) {
        this.cellRenderer = cellRenderer;
    }

    public Map<String, String> getCellRendererParams() {
        return cellRendererParams;
    }

    public void setCellRendererParams(Map<String, String> cellRendererParams) {
        this.cellRendererParams = cellRendererParams;
    }

    public Integer getWidth() {
        return width;
    }

    public void setWidth(Integer width) {
        this.width = width;
    }

    public Boolean getResizable() {
        return resizable;
    }

    public void setResizable(Boolean resizable) {
        this.resizable = resizable;
    }

    public String getPinned() {
        return pinned;
    }

    public void setPinned(String pinned) {
        this.pinned = pinned;
    }

    public Map<String, String> getCellStyle() {
        return cellStyle;
    }
    
    public void setCellStyle(Map<String, String> cellStyle) {
        this.cellStyle = cellStyle;
    }

    public String getSort() {
        return sort;
    }

    public void setSort(String sort) {
        this.sort = sort;
    }
}