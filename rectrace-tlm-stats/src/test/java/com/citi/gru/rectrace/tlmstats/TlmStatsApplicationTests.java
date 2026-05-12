package com.citi.gru.rectrace.tlmstats;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;

import com.citi.gru.rectrace.quickrec.service.QuickRecStatsService;
import com.citi.gru.rectrace.tlmstats.service.TlmStatsService;
import com.citi.gru.rectrace.tlmstats.service.TlmStatsV2Service;

@SpringBootTest
@ActiveProfiles("test")
class TlmStatsApplicationTests {

    // DatabaseConfig is @Profile("!test") so its beans (TlmJdbcTemplateFactory,
    // reconmgmtJdbcTemplate, recportalJdbcTemplate) are not registered.
    // Mock the services that depend on those beans so the full context loads.
    @MockBean
    TlmStatsService tlmStatsService;

    @MockBean
    TlmStatsV2Service tlmStatsV2Service;

    @MockBean
    QuickRecStatsService quickRecStatsService;

    @Test
    void contextLoads() {
    }

} 