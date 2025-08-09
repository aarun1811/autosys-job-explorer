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
public class InitialSearchResponseV4 {
    private Map<String, CategoryResultV4> categoryResults;
    private String searchTerm;
    private long timestamp;
}