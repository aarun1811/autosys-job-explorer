package com.citi.gru.rectrace.observability.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.Status;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * OBS-02 contract — {@link OracleHealthIndicator} runs {@code SELECT 1 FROM DUAL}
 * against the dedicated {@code healthCheckJdbcTemplate} and reports UP on success,
 * DOWN with the exception class+message on failure (via
 * {@code AbstractHealthIndicator}'s standard exception handling — Pitfall P-4).
 */
class OracleHealthIndicatorTest {

    @Test
    void upWhenQueryReturnsOne() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(eq("SELECT 1 FROM DUAL"), any(Class.class)))
                .thenReturn(Integer.valueOf(1));

        OracleHealthIndicator indicator = new OracleHealthIndicator(jdbc);
        Health health = indicator.health();

        assertThat(health.getStatus()).isEqualTo(Status.UP);
        assertThat(health.getDetails()).containsEntry("query", "SELECT 1 FROM DUAL");
    }

    @Test
    void downWhenDataSourceFails() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(eq("SELECT 1 FROM DUAL"), any(Class.class)))
                .thenThrow(new DataAccessResourceFailureException("oracle down"));

        OracleHealthIndicator indicator = new OracleHealthIndicator(jdbc);
        Health health = indicator.health();

        assertThat(health.getStatus()).isEqualTo(Status.DOWN);
        assertThat(health.getDetails()).containsKey("error");
        assertThat(health.getDetails().get("error").toString()).contains("oracle down");
    }

    @Test
    void downWhenJdbcTemplateMissing() {
        OracleHealthIndicator indicator = new OracleHealthIndicator((JdbcTemplate) null);
        Health health = indicator.health();

        assertThat(health.getStatus()).isEqualTo(Status.DOWN);
        assertThat(health.getDetails()).containsEntry("reason",
                "healthCheckJdbcTemplate not configured");
    }
}
