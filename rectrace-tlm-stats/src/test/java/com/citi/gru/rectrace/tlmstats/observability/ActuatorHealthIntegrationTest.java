package com.citi.gru.rectrace.tlmstats.observability;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.citi.gru.rectrace.quickrec.service.QuickRecStatsService;
import com.citi.gru.rectrace.tlmstats.service.TlmStatsService;
import com.citi.gru.rectrace.tlmstats.service.TlmStatsV2Service;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * OBS-02 contract — tlm-stats only ships an Oracle health indicator (reconmgmt DS
 * per Open Q9). No ES, no loader-run-age, no search-config. Plan 07-04 enabled.
 *
 * <p>In test profile {@code HealthIndicatorDataSourceConfig} is excluded
 * (@Profile("!test")), so the {@code healthCheckJdbcTemplate} bean is absent
 * and {@link com.citi.gru.rectrace.tlmstats.observability.health.OracleHealthIndicator}
 * reports DOWN with "not configured" reason — but it still surfaces
 * {@code $.components.oracle.status}, which is what this test asserts.
 * application-test.properties maps DOWN -> 200 so MockMvc sees a 200 envelope.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ActuatorHealthIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    TlmStatsService tlmStatsService;

    @MockBean
    TlmStatsV2Service tlmStatsV2Service;

    @MockBean
    QuickRecStatsService quickRecStatsService;

    @Test
    void healthExposesOracleStatusOnly() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.oracle.status").exists());
    }
}
