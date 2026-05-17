package com.citi.gru.rectrace.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.test.context.ActiveProfiles;

/**
 * OBS-06 contract — the {@code taskExecutor} {@code @Async} pool must copy the
 * MDC from the calling thread to the worker thread via a
 * {@code ContextPropagatingTaskDecorator} (Pitfall A4).
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(AsyncMdcPropagationTest.TraceEchoConfig.class)
class AsyncMdcPropagationTest {

    @Autowired
    private TraceEchoService echo;

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
    static class TraceEchoConfig {
        @Bean
        TraceEchoService traceEchoService() {
            return new TraceEchoService();
        }
    }

    @Service
    static class TraceEchoService {
        @Async("taskExecutor")
        public CompletableFuture<String> echoTrace() {
            return CompletableFuture.completedFuture(MDC.get("traceId"));
        }
    }
}
