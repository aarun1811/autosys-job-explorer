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
public class ElasticsearchConfig {
    private String index;
    private List<String> searchFields;
    private String collapseField;
    private int maxResults;
}