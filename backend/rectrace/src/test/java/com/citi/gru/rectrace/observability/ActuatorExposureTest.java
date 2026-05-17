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
 * OBS-03 contract — actuator exposure list is the explicit allow-list defined
 * in D-7.3: {@code health, info, prometheus, loggers, metrics}. Sensitive
 * endpoints ({@code env, heapdump, shutdown, beans, configprops, threaddump})
 * MUST NOT appear in the {@code _links} envelope. Plan 07-02 set the
 * application.properties exposure config and enabled this test.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ActuatorExposureTest {

    @Autowired
    private MockMvc mockMvc;

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
