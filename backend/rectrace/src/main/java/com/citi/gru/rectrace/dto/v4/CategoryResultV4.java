package com.citi.gru.rectrace.dto.v4;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CategoryResultV4 {
    private String key;
    private String label;
    private List<String> values;  // Unique values from ES (max 1000)
    private int count;
    private boolean hasMore;  // True if we hit the 1000 limit
    private List<ColumnDefinition> columns;
    private DashboardConfig dashboard;
}