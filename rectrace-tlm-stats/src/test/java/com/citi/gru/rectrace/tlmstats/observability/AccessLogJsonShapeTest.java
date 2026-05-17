package com.citi.gru.rectrace.tlmstats.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;

import com.citi.gru.rectrace.quickrec.service.QuickRecStatsService;
import com.citi.gru.rectrace.tlmstats.service.TlmStatsService;
import com.citi.gru.rectrace.tlmstats.service.TlmStatsV2Service;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * OBS-01 contract — tlm-stats access-log mirror. Plan 07-04 enabled.
 *
 * <p>DatabaseConfig is {@code @Profile("!test")} so the per-tlm-instance
 * {@code TlmJdbcTemplateFactory} bean is absent; the services that depend on
 * it must be mocked (mirrors {@code TlmStatsApplicationTests}). Web-tier
 * bean wiring is what we exercise here — controllers and filters — not the
 * service-layer database paths.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AccessLogJsonShapeTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    TlmStatsService tlmStatsService;

    @MockBean
    TlmStatsV2Service tlmStatsV2Service;

    @MockBean
    QuickRecStatsService quickRecStatsService;

    private Logger accessLogger;
    private ListAppender<ILoggingEvent> listAppender;

    @BeforeEach
    void attachAppender() {
        accessLogger = (Logger) LoggerFactory.getLogger("access");
        listAppender = new ListAppender<>();
        listAppender.start();
        accessLogger.addAppender(listAppender);
    }

    @AfterEach
    void detachAppender() {
        accessLogger.detachAppender(listAppender);
        listAppender.stop();
    }

    @Test
    void accessLogContainsCanonicalMdcKeys() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());

        assertThat(listAppender.list)
                .as("access logger should have captured exactly one request event")
                .hasSize(1);

        ILoggingEvent event = listAppender.list.get(0);
        Map<String, String> mdc = event.getMDCPropertyMap();

        assertThat(mdc).containsKeys("traceId", "path", "method", "status", "durationMs");
        assertThat(mdc.get("path")).isEqualTo("/actuator/health");
        assertThat(mdc.get("method")).isEqualTo("GET");
        assertThat(mdc.get("status")).isEqualTo("200");
        assertThat(mdc.get("traceId")).matches("[0-9a-f]{32}");
        assertThat(mdc.get("durationMs")).matches("\\d+");
    }
}
