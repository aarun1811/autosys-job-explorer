package com.citi.gru.rectrace.dto.v4;

import java.util.List;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Phase 5 / SQL-01 — root DTO for {@code sql-search-config-v4.json}.
 *
 * <p>Mirrors the {@code SearchConfigurationV4} shape: a single top-level list of tabs.
 * Each tab is a {@link SqlTabConfigV4} carrying a config-authored {@code SELECT}.
 */
@Data
@NoArgsConstructor
public class SqlSearchConfigV4 {
    private List<SqlTabConfigV4> tabs;
}
