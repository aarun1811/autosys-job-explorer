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
public class ExportRequestV4 {
    private String category;
    private InitialFilter initialFilter;
    private List<String> columns;  // Columns to export
    private List<String> rowGroupCols;
    private List<SortModel> sortModel;
}