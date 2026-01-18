package com.citi.gru.rectrace.dto.v4;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FilterModel {
    private String filterType;
    private String type;
    private String filter;
    private String operator;
    private String condition1;
    private String condition2;
}