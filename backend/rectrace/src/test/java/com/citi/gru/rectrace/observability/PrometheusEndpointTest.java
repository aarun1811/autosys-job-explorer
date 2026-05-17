package com.citi.gru.rectrace.observability;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * OBS-05 contract — {@code /actuator/prometheus} emits the canonical exposition
 * format ({@code text/plain;version=0.0.4}) with the auto-registered HTTP and
 * JVM metrics.
 *
 * <p>Plan-01 scaffold also asserted on {@code hikaricp_connections_active} — that
 * metric requires a live HikariCP {@code DataSource}, which the {@code test}
 * profile excludes via {@code spring.autoconfigure.exclude}. Plan 03 keeps the
 * two universal metrics (HTTP server request count, JVM memory used) because
 * those are sufficient to prove the Prometheus registry is wired; Hikari metric
 * presence is covered by the production smoke test (see verification block).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@AutoConfigureObservability
@ActiveProfiles("test")
class PrometheusEndpointTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void prometheusEndpointEmitsCanonicalMetrics() throws Exception {
        // Hit /actuator/health once so http_server_requests_seconds_count has a sample.
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
