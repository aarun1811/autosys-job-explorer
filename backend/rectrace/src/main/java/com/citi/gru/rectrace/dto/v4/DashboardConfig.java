package com.citi.gru.rectrace.dto.v4;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardConfig {
    private String url;          // recviz embed URL; may contain a {q} placeholder
    private String title;
    private Boolean defaultOpen;
    private Integer height;
}
