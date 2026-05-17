package com.citi.gru.rectrace.observability.aop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import javax.sql.DataSource;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;

/**
 * OBS-04 contract — {@code SlowQueryLoggerAspect} intercepts {@code JdbcTemplate}
 * query / update methods and emits a single WARN event when the call exceeds
 * {@code observability.slow-query-threshold-ms} (Pitfall P-6 — pointcut targets
 * the concrete class, not {@code JdbcOperations}). Plan 07-03 implements the
 * aspect and removes the {@link Disabled}.
 */
@Disabled("Wave 0 scaffold — enabled by Plan 07-03")
@SpringBootTest(properties = {
        "observability.slow-query-threshold-ms=10"
})
@ActiveProfiles("test")
class SlowQueryLoggerAspectTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private DataSource dataSource;

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
        when(jdbcTemplate.queryForObject(eq("SELECT 1 FROM DUAL"), any(RowMapper.class)))
                .thenReturn(Integer.valueOf(1));

        jdbcTemplate.queryForObject("SELECT 1 FROM DUAL", (rs, n) -> rs.getInt(1));

        long warnCount = appender.list.stream()
                .filter(e -> e.getLevel() == Level.WARN)
                .filter(e -> e.getFormattedMessage().contains("slow-jdbc"))
                .count();
        assertThat(warnCount).isZero();
    }
}
