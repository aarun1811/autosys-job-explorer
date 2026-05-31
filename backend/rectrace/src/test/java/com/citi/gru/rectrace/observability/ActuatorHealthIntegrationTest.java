package com.citi.gru.rectrace.observability;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * OBS-02 contract — {@code /actuator/health} aggregates Oracle / Elasticsearch /
 * search-config indicators. The loader-run-age indicator was moved out of
 * backend/rectrace in Phase 4 of the loader-extraction work and now lives in
 * the rectrace-loader module's own actuator surface on :6089.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ActuatorHealthIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthAggregatesOracleEsAndSearchConfig() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.oracle.status").exists())
                .andExpect(jsonPath("$.components.elasticsearch.status").exists())
                .andExpect(jsonPath("$.components.searchConfig.status").exists());
    }
}
