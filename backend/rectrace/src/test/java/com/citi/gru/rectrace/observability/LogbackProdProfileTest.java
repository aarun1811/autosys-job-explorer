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
import net.logstash.logback.appender.LogstashTcpSocketAppender;

/**
 * OBS-01 / OBS-07 prod-profile contract — when {@code spring.profiles.active=prod}
 * the root logger must include a {@link LogstashTcpSocketAppender} pointing at
 * Splunk HEC (per D-7.0). Plan 07-02 enabled this test by wiring the
 * profile-aware {@code logback-spring.xml}.
 */
// Note: the additional properties beyond the original Plan 01 set are necessary
// to load the context on dev laptops without Oracle wallets. They activate the
// `test` profile alongside `prod` so the project's many @Profile("!test")
// guards on infrastructure beans (DataSourceConfig, AutosysDataSourceConfig,
// CorrelationIdPropagationConfig, SecurityConfig, etc.) deactivate. The `prod`
// profile remains active so logback-spring.xml's <springProfile name="prod">
// branch is the one Spring resolves. The test method body is unchanged from
// Plan 01.
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.profiles.active=prod,test",
                "splunk.hec.host=127.0.0.1",
                "splunk.hec.port=9997"
        })
// @DirtiesContext forces a fresh ApplicationContext (and consequently a fresh
// LoggerContext re-evaluation of <springProfile> blocks) so the prod-profile
// logback wiring is rebuilt even when a previous @SpringBootTest in the same
// surefire fork left the LoggerContext singleton wired for the !prod branch.
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_CLASS)
class LogbackProdProfileTest {

    /**
     * Surefire runs all test classes in the same JVM by default, which means
     * the Logback LoggerContext singleton is shared across @SpringBootTest
     * runs. If any earlier test booted under the !prod profile (e.g.
     * ActuatorExposureTest with @ActiveProfiles("test")), the LoggerContext
     * is wired for the !prod branch of logback-spring.xml and Spring Boot's
     * LogbackLoggingSystem does NOT re-evaluate <springProfile> blocks for
     * later @SpringBootTest classes that activate prod. We force a re-read
     * here by setting spring.profiles.active=prod as a system property
     * BEFORE Spring's LogbackLoggingSystem initializes the context, so the
     * <springProfile name="prod"> branch wins this time around.
     */
    @BeforeAll
    static void primeProdProfileForLogback() {
        System.setProperty("spring.profiles.active", "prod");
        LoggerContext ctx = (LoggerContext) LoggerFactory.getILoggerFactory();
        ctx.reset();
    }

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
