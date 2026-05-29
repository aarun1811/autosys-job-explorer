package com.citi.gru.rectrace.tlmstats.observability.health;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Phase 7 / OBS-02 — dedicated, short-timeout JdbcTemplate for the
 * tlm-stats {@link OracleHealthIndicator}.
 *
 * <p>The shared {@code reconmgmtJdbcTemplate} (declared by {@code DatabaseConfig})
 * is consumed by {@code TlmStatsService}, {@code TlmStatsV2Service} and
 * {@code QuickRecStatsService}. Mutating its {@code queryTimeout} via
 * {@code setQueryTimeout(2)} would clamp every call site to 2 seconds
 * (Pitfall P-7 / Threat T-07-12). Instead this config exposes a NEW
 * {@link JdbcTemplate} bean named {@code healthCheckJdbcTemplate} that wraps
 * the {@code reconmgmtDataSource} but with a 2-second query timeout
 * (Pitfall P-5 / Threat T-07-13 — DoS mitigation when Oracle hangs).
 *
 * <p>Per Plan 07-04 Open Q9, the health probe targets ONLY the static
 * {@code reconmgmtDataSource}. Per-TLM-instance datasources (dynamically
 * constructed from {@code tlm-instances.json}) are deliberately excluded
 * because probing all 9 instances on each {@code /actuator/health} request
 * would amplify load 9× and flap the aggregate health state any time one
 * TLM instance is down (Threat T-07-22).
 *
 * <p>{@code @Profile("!test")} keeps the bean out of the test ApplicationContext
 * where {@code DatabaseConfig} (also {@code @Profile("!test")}) is excluded
 * and no {@code reconmgmtDataSource} bean exists;
 * {@code @ConditionalOnBean(name="reconmgmtDataSource")} guards against
 * environments where that DataSource is wired elsewhere.
 */
@Profile("!test")
@Configuration
public class HealthIndicatorDataSourceConfig {

    /** D-7.12 / Pitfall P-5 — 2 s ceiling per probe call. */
    static final int HEALTH_CHECK_QUERY_TIMEOUT_SECONDS = 2;

    @Bean("healthCheckJdbcTemplate")
    @ConditionalOnBean(name = "reconmgmtDataSource")
    public JdbcTemplate healthCheckJdbcTemplate(
            @Qualifier("reconmgmtDataSource") DataSource dataSource) {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        jdbc.setQueryTimeout(HEALTH_CHECK_QUERY_TIMEOUT_SECONDS);
        return jdbc;
    }
}
