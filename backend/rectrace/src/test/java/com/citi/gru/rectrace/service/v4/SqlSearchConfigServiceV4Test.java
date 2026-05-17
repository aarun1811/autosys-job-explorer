package com.citi.gru.rectrace.service.v4;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import com.citi.gru.rectrace.dto.v4.SqlTabConfigV4;

/**
 * Phase 5 / SQL-01: end-to-end Spring context test — boots with the good fixture
 * config and asserts the service exposes the expected tabs.
 *
 * <p>Wave 4 (Plan 05-04): enabled, real {@link SqlSearchConfigServiceV4} autowired.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "sql-search-config.location=classpath:sql-search-config-good.json")
class SqlSearchConfigServiceV4Test {

    @Autowired
    private SqlSearchConfigServiceV4 service;

    @Test
    void loadsTabs() {
        assertThat(service.getTabs()).isNotEmpty();
        assertThat(service.getTabs())
            .extracting(SqlTabConfigV4::getKey)
            .contains("reconSummary");
    }

    @Test
    void getTabByKeyReturnsConfiguredTab() {
        assertThat(service.getTab("reconSummary"))
            .isPresent()
            .hasValueSatisfying(tab -> {
                assertThat(tab.getLabel()).isEqualTo("Recon Summary (SQL)");
                assertThat(tab.getColumns()).hasSize(6);
            });
    }

    @Test
    void getTabByUnknownKeyReturnsEmpty() {
        assertThat(service.getTab("nonexistent")).isEmpty();
    }
}
