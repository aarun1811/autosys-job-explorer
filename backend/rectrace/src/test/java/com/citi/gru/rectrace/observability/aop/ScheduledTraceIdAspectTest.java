package com.citi.gru.rectrace.observability.aop;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.test.context.ActiveProfiles;

/**
 * OBS-06 contract — every {@code @Scheduled} fire receives a fresh 32-hex-char
 * {@code traceId} in MDC (D-7.10).
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(ScheduledTraceIdAspectTest.SyntheticScheduledConfig.class)
class ScheduledTraceIdAspectTest {

    @Autowired
    private SyntheticScheduledBean scheduledBean;

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void scheduledFireProducesThirtyTwoHexTraceId() {
        String firstTrace = scheduledBean.captureTrace();
        assertThat(firstTrace)
                .as("traceId injected by aspect into @Scheduled method")
                .isNotNull()
                .matches("[0-9a-f]{32}");
    }

    @Test
    void consecutiveSchedulerInvocationsProduceDistinctTraceIds() {
        String firstTrace = scheduledBean.captureTrace();
        String secondTrace = scheduledBean.captureTrace();
        assertThat(firstTrace).isNotEqualTo(secondTrace);
        assertThat(firstTrace).matches("[0-9a-f]{32}");
        assertThat(secondTrace).matches("[0-9a-f]{32}");
    }

    @TestConfiguration
    static class SyntheticScheduledConfig {
        @Bean
        SyntheticScheduledBean syntheticScheduledBean() {
            return new SyntheticScheduledBean();
        }
    }

    @Component
    static class SyntheticScheduledBean {
        // initialDelay / fixedDelay are Long.MAX_VALUE so the bean is NEVER fired by
        // the scheduler. We invoke captureTrace() directly through the Spring proxy
        // to exercise the @Scheduled-aware AOP advice without triggering a real fire.
        @Scheduled(fixedDelay = Long.MAX_VALUE, initialDelay = Long.MAX_VALUE)
        public String captureTrace() {
            return MDC.get("traceId");
        }
    }
}
