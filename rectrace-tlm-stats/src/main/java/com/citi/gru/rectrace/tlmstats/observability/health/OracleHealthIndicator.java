package com.citi.gru.rectrace.tlmstats.observability.health;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.actuate.health.AbstractHealthIndicator;
import org.springframework.boot.actuate.health.Health;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

/**
 * Phase 7 / OBS-02 — tlm-stats mirror of backend/rectrace's
 * {@code OracleHealthIndicator}. Runs {@code SELECT 1 FROM DUAL} against the
 * {@code reconmgmt} Oracle datasource via the dedicated
 * {@code healthCheckJdbcTemplate} (2 s query timeout — Pitfall P-5 /
 * Threat T-07-13).
 *
 * <p>Bean name {@code "oracle"} surfaces as {@code $.components.oracle} in the
 * actuator JSON envelope (Pitfall P-4: extend {@link AbstractHealthIndicator}
 * so thrown exceptions map cleanly to DOWN with an {@code error} detail).
 *
 * <p>The {@link Qualifier} + {@code required=false} pattern allows boot in the
 * {@code test} profile where {@link HealthIndicatorDataSourceConfig} is
 * excluded (no {@code reconmgmtDataSource}). When the template is absent the
 * indicator reports DOWN with a "not configured" reason so the actuator JSON
 * still carries a {@code $.components.oracle.status} field — which is what
 * {@code ActuatorHealthIntegrationTest} asserts.
 *
 * <p>Per Plan 07-04 Open Q9, this probe targets ONLY the static
 * {@code reconmgmtDataSource}. Per-TLM-instance datasources are intentionally
 * NOT probed (T-07-22).
 */
@Component("oracle")
public class OracleHealthIndicator extends AbstractHealthIndicator {

    private final JdbcTemplate jdbc;

    @Autowired(required = false)
    public OracleHealthIndicator(@Qualifier("healthCheckJdbcTemplate")
                                 @Nullable JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    protected void doHealthCheck(Health.Builder builder) {
        if (jdbc == null) {
            builder.down().withDetail("reason", "healthCheckJdbcTemplate not configured");
            return;
        }
        Integer one = jdbc.queryForObject("SELECT 1 FROM DUAL", Integer.class);
        if (one != null && one == 1) {
            builder.up().withDetail("query", "SELECT 1 FROM DUAL");
        } else {
            builder.down().withDetail("reason", "unexpected result: " + one);
        }
    }
}
