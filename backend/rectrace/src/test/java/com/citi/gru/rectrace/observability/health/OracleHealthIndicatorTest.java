package com.citi.gru.rectrace.observability.health;

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
 * OBS-02 contract — {@code OracleHealthIndicator} runs {@code SELECT 1 FROM DUAL}
 * against the primary datasource and reports UP on success, DOWN with the
 * exception class+message on failure. Plan 07-03 implements the indicator and
 * removes the {@link Disabled}.
 */
@Disabled("Wave 0 scaffold — enabled by Plan 07-03")
class OracleHealthIndicatorTest {

    @Test
    void upWhenQueryReturnsOne() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(eq("SELECT 1 FROM DUAL"), any(Class.class)))
                .thenReturn(Integer.valueOf(1));

        HealthIndicator indicator = newIndicator(jdbc);
        Health health = indicator.health();

        assertThat(health.getStatus()).isEqualTo(Status.UP);
    }

    @Test
    void downWhenDataSourceFails() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(eq("SELECT 1 FROM DUAL"), any(Class.class)))
                .thenThrow(new DataAccessResourceFailureException("oracle down"));

        HealthIndicator indicator = newIndicator(jdbc);
        Health health = indicator.health();

        assertThat(health.getStatus()).isEqualTo(Status.DOWN);
        assertThat(health.getDetails()).containsKey("error");
        assertThat(health.getDetails().get("error").toString()).contains("oracle down");
    }

    /**
     * Plan 07-03 will provide the production constructor. For now this helper is
     * a placeholder that the implementing plan rewires to {@code new OracleHealthIndicator(jdbc)}.
     */
    private HealthIndicator newIndicator(JdbcTemplate jdbc) {
        return new OracleHealthIndicator(jdbc);
    }

    /**
     * Forward declaration so the test class compiles before Plan 07-03 lands the
     * real implementation in main sources. Plan 07-03 deletes this inner stub and
     * imports {@code com.citi.gru.rectrace.observability.health.OracleHealthIndicator}
     * from {@code main/java/} instead.
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
