package com.citi.gru.rectrace.tlmstats.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.stereotype.Service;
import org.springframework.test.context.ActiveProfiles;

/**
 * OBS-06 contract — tlm-stats has no @Async beans today so the test declares a
 * synthetic @Async @Service via @TestConfiguration. Plan 07-04 wires the
 * ContextPropagatingTaskDecorator (if it adds an AsyncConfig) and removes
 * the {@link Disabled}.
 */
@Disabled("Wave 0 scaffold — enabled by Plan 07-04")
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
