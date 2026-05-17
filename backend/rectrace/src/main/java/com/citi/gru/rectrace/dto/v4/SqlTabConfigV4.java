package com.citi.gru.rectrace.dto.v4;

import java.util.List;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Phase 5 / SQL-01 — single SQL-tab entry in {@code sql-search-config-v4.json}.
 *
 * <p>Each tab carries a config-authored {@code SELECT} (or {@code WITH ... SELECT}) query
 * that is validated by {@code SqlShapeValidator} at boot time. The {@code columns} list
 * mirrors the existing v4 column-definition shape so AG-Grid SSRM can consume rows.
 */
@Data
@NoArgsConstructor
public class SqlTabConfigV4 {
    private String key;
    private String label;
    private String query;
    private List<ColumnDefinition> columns;
}
