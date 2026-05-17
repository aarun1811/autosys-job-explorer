package com.citi.gru.rectrace.service.v4;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

/**
 * Phase 5 / SQL-01: locks the SqlSearchConfigServiceV4 contract — at least one tab loaded
 * from the happy-path config fixture, including the example {@code reconSummary} tab.
 *
 * <p>Wave 0 scaffolding — {@code @Disabled} until Wave 4 lands {@code SqlSearchConfigServiceV4}.
 *
 * <p>TODO Wave 4: remove the inline {@link StubTabConfig} record and the local {@code loadTabs()}
 * helper; inject the real service via {@code @Autowired SqlSearchConfigServiceV4 service;} and
 * call {@code service.getTabs()}.
 */
class SqlSearchConfigServiceV4Test {

    /**
     * TODO Wave 4: delete. Placeholder type so this file compiles standalone.
     * The real config DTO will be {@code com.citi.gru.rectrace.dto.v4.SqlTabConfigV4}.
     */
    private record StubTabConfig(String key, String label) {}

    /**
     * TODO Wave 4: delete; replace with {@code service.getTabs()}.
     */
    private static List<StubTabConfig> loadTabs() {
        return List.of();
    }

    @Disabled("Wave 4: enabled when SqlSearchConfigServiceV4 lands")
    @Test
    void loadsTabs() {
        List<StubTabConfig> tabs = loadTabs();
        assertThat(tabs).isNotEmpty();
        assertThat(tabs).extracting(StubTabConfig::key).contains("reconSummary");
    }
}
