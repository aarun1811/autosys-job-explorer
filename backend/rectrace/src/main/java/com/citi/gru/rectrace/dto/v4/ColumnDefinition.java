package com.citi.gru.rectrace.dto.v4;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ColumnDefinition {
    private String field;
    private String headerName;
    private Boolean rowGroup;
    private Boolean hide;
    private Boolean sortable;
    private Boolean filter;
    private Boolean resizable;
    private Integer width;
    private String cellRenderer;
    private Map<String, Object> cellRendererParams;
    private Map<String, Object> cellStyle;
    private String pinned;
}