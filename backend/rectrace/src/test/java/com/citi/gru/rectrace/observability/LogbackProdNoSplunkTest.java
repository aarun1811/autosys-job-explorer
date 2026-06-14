package com.citi.gru.rectrace.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Iterator;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.Appender;
import ch.qos.logback.core.rolling.RollingFileAppender;
import net.logstash.logback.appender.LogstashTcpSocketAppender;

/**
 * OBS-07 — "Splunk is opt-in" contract. Under {@code prod} WITHOUT the {@code splunk}
 * profile, the context must boot cleanly and attach NO Splunk appender, EVEN with an
 * empty {@code splunk.hec.host}. This pins the fix for the production startup failure
 * where an empty host produced a host-less {@code LogstashTcpSocketAppender} destination
 * ({@code :9997}) and {@code addDestination} threw at config time. The rotating
 * {@code FILE_JSON} appender must still be present.
 *
 * <p>Mirrors {@code LogbackProdProfileTest}'s @BeforeAll priming + @DirtiesContext to cope
 * with the JVM-wide Logback {@code LoggerContext} singleton shared across surefire forks.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.profiles.active=prod,test",
                "splunk.hec.host=",
                "splunk.hec.port="
        })
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_CLASS)
class LogbackProdNoSplunkTest {

    @BeforeAll
    static void primeProdNoSplunkProfileForLogback() {
        System.setProperty("spring.profiles.active", "prod");
        LoggerContext ctx = (LoggerContext) LoggerFactory.getILoggerFactory();
        ctx.reset();
    }

    @Test
    void prodWithoutSplunkProfileHasNoSplunkAppenderButKeepsFileAppender() {
        LoggerContext ctx = (LoggerContext) LoggerFactory.getILoggerFactory();
        Logger root = ctx.getLogger(Logger.ROOT_LOGGER_NAME);

        boolean hasSplunk = false;
        boolean hasFile = false;
        for (Iterator<Appender<ILoggingEvent>> it = root.iteratorForAppenders(); it.hasNext(); ) {
            Appender<ILoggingEvent> appender = it.next();
            if (appender instanceof LogstashTcpSocketAppender) {
                hasSplunk = true;
            }
            if (appender instanceof RollingFileAppender) {
                hasFile = true;
            }
        }

        assertThat(hasSplunk)
                .as("prod WITHOUT the `splunk` profile must NOT register a Splunk TCP appender "
                        + "(so an empty splunk.hec.host can never break startup)")
                .isFalse();
        assertThat(hasFile)
                .as("prod must still register the rotating FILE_JSON appender")
                .isTrue();
    }
}
