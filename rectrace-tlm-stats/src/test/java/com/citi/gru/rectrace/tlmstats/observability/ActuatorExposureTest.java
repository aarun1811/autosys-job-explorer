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
 * OBS-03 contract — tlm-stats actuator exposure mirrors backend/rectrace.
 * Plan 07-04 enabled.
 *
 * <p>Service @MockBeans mirror {@code TlmStatsApplicationTests} — DatabaseConfig
 * is {@code @Profile("!test")} so its beans are absent and the services that
 * depend on {@code TlmJdbcTemplateFactory} must be supplied as mocks.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ActuatorExposureTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    TlmStatsService tlmStatsService;

    @MockBean
    TlmStatsV2Service tlmStatsV2Service;

    @MockBean
    QuickRecStatsService quickRecStatsService;

    @Test
    void allowListedEndpointsArePresent() throws Exception {
        mockMvc.perform(get("/actuator"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$._links.health").exists())
                .andExpect(jsonPath("$._links.info").exists())
                .andExpect(jsonPath("$._links.prometheus").exists())
                .andExpect(jsonPath("$._links.loggers").exists())
                .andExpect(jsonPath("$._links.metrics").exists());
    }

    @Test
    void denyListedEndpointsAreAbsent() throws Exception {
        mockMvc.perform(get("/actuator"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$._links.env").doesNotExist())
                .andExpect(jsonPath("$._links.heapdump").doesNotExist())
                .andExpect(jsonPath("$._links.shutdown").doesNotExist())
                .andExpect(jsonPath("$._links.beans").doesNotExist())
                .andExpect(jsonPath("$._links.configprops").doesNotExist())
                .andExpect(jsonPath("$._links.threaddump").doesNotExist());
    }
}
