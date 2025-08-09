package com.citi.gru.rectrace.dto.v4;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SSRMRequestV4 {
    private String category;
    private InitialFilter initialFilter;  // ES results as filter
    private List<String> rowGroupCols;
    private List<String> groupKeys;
    private List<SortModel> sortModel;
    private Map<String, FilterModel> filterModel;
    private int startRow;
    private int endRow;
}