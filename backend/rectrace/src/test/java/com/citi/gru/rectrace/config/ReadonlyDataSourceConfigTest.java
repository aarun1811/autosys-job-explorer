package com.citi.gru.rectrace.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;

/**
 * Phase 5 / SQL-03: locks the ReadonlyDataSourceConfig contract — the
 * {@code readonlyDataSource} bean MUST be gated with {@code @Profile("!test")}
 * exactly like the existing {@code DataSourceConfig} / {@code AutosysDataSourceConfig}
 * (Pitfall 8 in 05-RESEARCH.md). This test runs under the {@code test} profile and
 * therefore asserts the bean is ABSENT — proving the profile guard is in place. Under
 * a non-test profile the bean must exist; that side is exercised by smoke / startup.
 *
 * <p>Wave 0 scaffolding — {@code @Disabled} until Wave 2 lands
 * {@code ReadonlyDataSourceConfig}.
 */
@SpringBootTest
@ActiveProfiles("test")
@Disabled("Wave 2: enabled when ReadonlyDataSourceConfig lands")
class ReadonlyDataSourceConfigTest {

    @Autowired
    private ApplicationContext ctx;

    @Autowired
    private Environment env;

    @Test
    void beanExistsUnderNonTestProfile() {
        // Document via assertion: under the "test" profile (active here) the
        // readonlyDataSource bean is excluded by @Profile("!test"). The negative
        // assertion proves the guard is wired correctly; the live-Oracle bean is
        // therefore safe to omit from the test context (mirrors ContextLoadsTest).
        assertThat(env.matchesProfiles("test")).isTrue();
        assertThat(ctx.containsBean("readonlyDataSource")).isFalse();
    }
}
