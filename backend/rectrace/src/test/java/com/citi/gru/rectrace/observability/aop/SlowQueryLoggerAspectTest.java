package com.citi.gru.rectrace.observability.aop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;

/**
 * OBS-04 contract — {@link SlowQueryLoggerAspect} intercepts {@code JdbcTemplate}
 * query / update methods and emits a single WARN event when the call exceeds
 * {@code observability.slow-query-threshold-ms} (Pitfall P-6 — pointcut targets
 * the concrete class, not {@code JdbcOperations}).
 *
 * <p>The production aspect is {@code @Profile("!test")} (Pitfall P-9), so this
 * test registers an instance explicitly in {@link AspectRegistration} and switches
 * on {@link EnableAspectJAutoProxy} from the same {@link TestConfiguration}.
 */
@SpringBootTest(properties = {
        "observability.slow-query-threshold-ms=10"
})
@ActiveProfiles("test")
@Import(SlowQueryLoggerAspectTest.AspectRegistration.class)
class SlowQueryLoggerAspectTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Logger aspectLogger;
    private ListAppender<ILoggingEvent> appender;

    @BeforeEach
    void attachAppender() {
        aspectLogger = (Logger) LoggerFactory.getLogger(
                "com.citi.gru.rectrace.observability.aop.SlowQueryLoggerAspect");
        appender = new ListAppender<>();
        appender.start();
        aspectLogger.addAppender(appender);
    }

    @AfterEach
    void detachAppender() {
        aspectLogger.detachAppender(appender);
        appender.stop();
    }

    @Test
    @SuppressWarnings("unchecked")
    void overThresholdQueryEmitsExactlyOneWarn() {
        when(jdbcTemplate.queryForObject(eq("SELECT 1 FROM DUAL"), any(Class.class)))
                .thenAnswer(inv -> {
                    Thread.sleep(50);
                    return Integer.valueOf(1);
                });

        Integer result = jdbcTemplate.queryForObject("SELECT 1 FROM DUAL", Integer.class);
        assertThat(result).isEqualTo(1);

        long warnCount = appender.list.stream()
                .filter(e -> e.getLevel() == Level.WARN)
                .filter(e -> e.getFormattedMessage().contains("slow-jdbc"))
                .filter(e -> e.getFormattedMessage().contains("durationMs="))
                .count();
        assertThat(warnCount).isEqualTo(1);
    }

    @Test
    @SuppressWarnings("unchecked")
    void underThresholdQueryEmitsNoWarn() {
        when(jdbcTemplate.queryForObject(eq("SELECT 1 FROM DUAL"), any(Class.class)))
                .thenReturn(Integer.valueOf(1));

        jdbcTemplate.queryForObject("SELECT 1 FROM DUAL", Integer.class);

        long warnCount = appender.list.stream()
                .filter(e -> e.getLevel() == Level.WARN)
                .filter(e -> e.getFormattedMessage().contains("slow-jdbc"))
                .count();
        assertThat(warnCount).isZero();
    }

    @Test
    void slowLogAnnotatedMethodEmitsWarn() {
        SlowLogTarget target = new SlowLogTarget();
        // Wrap the target in an AspectJ proxy that includes our aspect.
        org.springframework.aop.aspectj.annotation.AspectJProxyFactory factory =
                new org.springframework.aop.aspectj.annotation.AspectJProxyFactory(target);
        factory.addAspect(new SlowQueryLoggerAspect(10L));
        SlowLogTarget proxied = factory.getProxy();

        proxied.slow();

        long warnCount = appender.list.stream()
                .filter(e -> e.getLevel() == Level.WARN)
                .filter(e -> e.getFormattedMessage().contains("slow-slowlog"))
                .count();
        assertThat(warnCount).isEqualTo(1);
    }

    static class SlowLogTarget {
        @SlowLog
        public void slow() {
            try {
                Thread.sleep(50);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
        }
    }

    /**
     * Registers a real {@link JdbcTemplate} Spring bean (Mockito-mock so we can stub
     * {@code queryForObject}) plus the {@link SlowQueryLoggerAspect} itself. The aspect's
     * production declaration is {@code @Profile("!test")}; here we register a fresh
     * instance bound to the property-driven threshold. {@link EnableAspectJAutoProxy}
     * activates the AOP proxy so the aspect's pointcut is actually applied.
     */
    @TestConfiguration
    @EnableAspectJAutoProxy
    static class AspectRegistration {
        @Bean
        public JdbcTemplate jdbcTemplate() {
            return mock(JdbcTemplate.class);
        }

        @Bean
        public SlowQueryLoggerAspect slowQueryLoggerAspect() {
            return new SlowQueryLoggerAspect(10L);
        }
    }
}
