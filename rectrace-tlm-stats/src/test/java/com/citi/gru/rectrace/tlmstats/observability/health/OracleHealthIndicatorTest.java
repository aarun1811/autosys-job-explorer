package com.citi.gru.rectrace.tlmstats.observability.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.actuate.health.Status;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * OBS-02 contract — tlm-stats {@code OracleHealthIndicator} mirrors the
 * backend/rectrace shape but targets the reconmgmt datasource (per Open Q9).
 * Plan 07-04 implements the indicator and removes the {@link Disabled}.
 */
@Disabled("Wave 0 scaffold — enabled by Plan 07-04")
class OracleHealthIndicatorTest {

    @Test
    void upWhenQueryReturnsOne() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(eq("SELECT 1 FROM DUAL"), any(Class.class)))
                .thenReturn(Integer.valueOf(1));

        HealthIndicator indicator = new OracleHealthIndicator(jdbc);
        Health health = indicator.health();

        assertThat(health.getStatus()).isEqualTo(Status.UP);
    }

    @Test
    void downWhenDataSourceFails() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(eq("SELECT 1 FROM DUAL"), any(Class.class)))
                .thenThrow(new DataAccessResourceFailureException("oracle down"));

        HealthIndicator indicator = new OracleHealthIndicator(jdbc);
        Health health = indicator.health();

        assertThat(health.getStatus()).isEqualTo(Status.DOWN);
        assertThat(health.getDetails()).containsKey("error");
        assertThat(health.getDetails().get("error").toString()).contains("oracle down");
    }

    /**
     * Forward declaration. Plan 07-04 replaces with the real
     * {@code com.citi.gru.rectrace.tlmstats.observability.health.OracleHealthIndicator}.
     */
    static class OracleHealthIndicator implements HealthIndicator {
        private final JdbcTemplate jdbc;

        OracleHealthIndicator(JdbcTemplate jdbc) {
            this.jdbc = jdbc;
        }

        @Override
        public Health health() {
            try {
                jdbc.queryForObject("SELECT 1 FROM DUAL", Integer.class);
                return Health.up().build();
            } catch (Exception e) {
                return Health.down()
                        .withDetail("error", e.getClass().getSimpleName() + ": " + e.getMessage())
                        .build();
            }
        }
    }
}
