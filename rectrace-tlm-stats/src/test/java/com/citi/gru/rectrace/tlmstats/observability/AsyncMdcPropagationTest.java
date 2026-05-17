package com.citi.gru.rectrace.tlmstats.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.stereotype.Service;
import org.springframework.test.context.ActiveProfiles;

import com.citi.gru.rectrace.quickrec.service.QuickRecStatsService;
import com.citi.gru.rectrace.tlmstats.service.TlmStatsService;
import com.citi.gru.rectrace.tlmstats.service.TlmStatsV2Service;

/**
 * OBS-06 contract — Plan 07-04 wired the {@code ContextPropagatingTaskDecorator}
 * via the new {@code com.citi.gru.rectrace.tlmstats.config.AsyncConfig}. This
 * test declares a synthetic {@code @Async} {@code @Service} via
 * {@code @TestConfiguration} that returns the MDC traceId observed on the worker
 * thread; the assertion is that it equals the caller's traceId.
 *
 * <p>Note: the {@code TraceEchoConfig.@EnableAsync} below would in principle
 * create its own taskExecutor, but because the main-source {@link AsyncConfig}
 * is also active under {@code @SpringBootTest}, Spring uses the main
 * {@code taskExecutor} bean which has {@link
 * org.springframework.core.task.support.ContextPropagatingTaskDecorator}
 * attached — that's what makes the propagation assertion pass.
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(AsyncMdcPropagationTest.TraceEchoConfig.class)
class AsyncMdcPropagationTest {

    @Autowired
    private TraceEchoService echo;

    @MockBean
    TlmStatsService tlmStatsService;

    @MockBean
    TlmStatsV2Service tlmStatsV2Service;

    @MockBean
    QuickRecStatsService quickRecStatsService;

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void mdcTraceIdIsCopiedToAsyncThread() throws Exception {
        MDC.put("traceId", "abc123def4567890abc123def4567890");
        CompletableFuture<String> future = echo.echoTrace();
        String result = future.get(5, TimeUnit.SECONDS);
        assertThat(result).isEqualTo("abc123def4567890abc123def4567890");
    }

    @TestConfiguration
    @EnableAsync
    static class TraceEchoConfig {
        @Bean
        TraceEchoService traceEchoService() {
            return new TraceEchoService();
        }
    }

    @Service
    static class TraceEchoService {
        @Async
        public CompletableFuture<String> echoTrace() {
            return CompletableFuture.completedFuture(MDC.get("traceId"));
        }
    }
}
