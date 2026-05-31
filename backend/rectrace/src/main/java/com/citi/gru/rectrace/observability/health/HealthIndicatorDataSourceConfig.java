package com.citi.gru.rectrace.observability.health;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Phase 7 / OBS-02 — dedicated, short-timeout JdbcTemplate for the {@link OracleHealthIndicator}.
 *
 * <p>The shared primary {@link JdbcTemplate} (declared by {@code DataSourceConfig#primaryJdbcTemplate})
 * is consumed by V4 search code paths. The loader subsystem moved to {@code rectrace-loader/}
 * (2026-05-31 extraction). Mutating its {@code queryTimeout} via {@code setQueryTimeout(2)} would clamp every
 * call site to 2 seconds (Pitfall P-7 / Threat T-07-12). Instead this config exposes a
 * NEW {@link JdbcTemplate} bean named {@code healthCheckJdbcTemplate} that wraps the
 * same primary {@link DataSource} but with a 2-second query timeout (Pitfall P-5 /
 * Threat T-07-13 — DoS mitigation when Oracle hangs).
 *
 * <p>{@code @Profile("!test")} keeps the bean out of the test ApplicationContext where
 * the primary {@link DataSource} is excluded; {@code @ConditionalOnBean(name="dataSource")}
 * guards against environments where the primary DS is wired elsewhere (e.g. UAT smoke).
 */
@Profile("!test")
@Configuration
public class HealthIndicatorDataSourceConfig {

    /** D-7.12 / Pitfall P-5 — 2 s ceiling per probe call. */
    static final int HEALTH_CHECK_QUERY_TIMEOUT_SECONDS = 2;

    @Bean("healthCheckJdbcTemplate")
    @ConditionalOnBean(name = "dataSource")
    public JdbcTemplate healthCheckJdbcTemplate(@Qualifier("dataSource") DataSource dataSource) {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        jdbc.setQueryTimeout(HEALTH_CHECK_QUERY_TIMEOUT_SECONDS);
        return jdbc;
    }
}
