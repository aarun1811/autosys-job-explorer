package com.citi.gru.rectrace.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Iterator;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.Appender;
import net.logstash.logback.appender.LogstashTcpSocketAppender;

/**
 * OBS-01 / OBS-07 prod-profile contract — when {@code spring.profiles.active=prod}
 * the root logger must include a {@link LogstashTcpSocketAppender} pointing at
 * Splunk HEC (per D-7.0). Plan 07-02 wires {@code logback-spring.xml} and removes
 * the {@link Disabled} annotation.
 */
@Disabled("Wave 0 scaffold — enabled by Plan 07-02")
@SpringBootTest(properties = {
        "spring.profiles.active=prod",
        "splunk.hec.host=127.0.0.1",
        "splunk.hec.port=9997"
})
class LogbackProdProfileTest {

    @Test
    void rootLoggerHasLogstashTcpSocketAppender() {
        LoggerContext ctx = (LoggerContext) LoggerFactory.getILoggerFactory();
        Logger root = ctx.getLogger(Logger.ROOT_LOGGER_NAME);

        boolean found = false;
        for (Iterator<Appender<ILoggingEvent>> it = root.iteratorForAppenders(); it.hasNext(); ) {
            Appender<ILoggingEvent> appender = it.next();
            if (appender instanceof LogstashTcpSocketAppender) {
                found = true;
                break;
            }
        }
        assertThat(found)
                .as("prod profile must register a LogstashTcpSocketAppender on the root logger")
                .isTrue();
    }
}
