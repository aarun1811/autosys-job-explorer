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
public class CategoryConfigV4 {
    private String key;
    private String label;
    private String searchColumn;
    private ElasticsearchConfig elasticsearch;
    private OracleConfig oracle;
    private List<ColumnDefinition> columns;
    private DashboardConfig dashboard;
}