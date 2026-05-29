package com.citi.gru.rectrace.tlmstats.observability;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.citi.gru.rectrace.quickrec.service.QuickRecStatsService;
import com.citi.gru.rectrace.tlmstats.service.TlmStatsService;
import com.citi.gru.rectrace.tlmstats.service.TlmStatsV2Service;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * OBS-05 contract — tlm-stats /actuator/prometheus. Plan 07-04 enabled.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PrometheusEndpointTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    TlmStatsService tlmStatsService;

    @MockBean
    TlmStatsV2Service tlmStatsV2Service;

    @MockBean
    QuickRecStatsService quickRecStatsService;

    @Test
    void prometheusEndpointEmitsCanonicalMetrics() throws Exception {
        mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());

        MvcResult result = mockMvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isOk())
                .andReturn();

        String contentType = result.getResponse().getContentType();
        assertThat(contentType).isNotNull();
        assertThat(contentType.toLowerCase()).contains("text/plain").contains("version=0.0.4");

        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("http_server_requests_seconds_count");
        assertThat(body).contains("jvm_memory_used_bytes");
    }
}
