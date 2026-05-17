package com.citi.gru.rectrace.observability.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.actuate.health.Status;

import com.citi.gru.rectrace.service.v4.SearchConfigServiceV4;
import com.citi.gru.rectrace.service.v4.SqlSearchConfigServiceV4;

/**
 * OBS-02 contract — {@code SearchConfigHealthIndicator} is DOWN if either the
 * JSON-driven {@code SearchConfigServiceV4} or the SQL-driven
 * {@code SqlSearchConfigServiceV4} reports an empty category list. Plan 07-03
 * wires the real beans and removes the {@link Disabled}.
 */
@Disabled("Wave 0 scaffold — enabled by Plan 07-03")
class SearchConfigHealthIndicatorTest {

    @Test
    void upWhenBothServicesReportNonEmptyCategories() {
        SearchConfigServiceV4 v4 = mock(SearchConfigServiceV4.class);
        SqlSearchConfigServiceV4 sql = mock(SqlSearchConfigServiceV4.class);
        when(v4.getCategories()).thenReturn(List.of(mock(com.citi.gru.rectrace.dto.v4.CategoryConfigV4.class)));
        when(sql.getTabs()).thenReturn(List.of(mock(com.citi.gru.rectrace.dto.v4.SqlTabConfigV4.class)));

        HealthIndicator indicator = new SearchConfigHealthIndicator(v4, sql);
        Health h = indicator.health();

        assertThat(h.getStatus()).isEqualTo(Status.UP);
        assertThat(h.getDetails()).containsKeys("v4Loaded", "sqlLoaded");
        assertThat(h.getDetails().get("v4Loaded")).isEqualTo(Boolean.TRUE);
        assertThat(h.getDetails().get("sqlLoaded")).isEqualTo(Boolean.TRUE);
    }

    @Test
    void downWhenV4Empty() {
        SearchConfigServiceV4 v4 = mock(SearchConfigServiceV4.class);
        SqlSearchConfigServiceV4 sql = mock(SqlSearchConfigServiceV4.class);
        when(v4.getCategories()).thenReturn(List.of());
        when(sql.getTabs()).thenReturn(List.of(mock(com.citi.gru.rectrace.dto.v4.SqlTabConfigV4.class)));

        HealthIndicator indicator = new SearchConfigHealthIndicator(v4, sql);
        Health h = indicator.health();

        assertThat(h.getStatus()).isEqualTo(Status.DOWN);
        assertThat(h.getDetails().get("v4Loaded")).isEqualTo(Boolean.FALSE);
        assertThat(h.getDetails().get("sqlLoaded")).isEqualTo(Boolean.TRUE);
    }

    @Test
    void downWhenSqlEmpty() {
        SearchConfigServiceV4 v4 = mock(SearchConfigServiceV4.class);
        SqlSearchConfigServiceV4 sql = mock(SqlSearchConfigServiceV4.class);
        when(v4.getCategories()).thenReturn(List.of(mock(com.citi.gru.rectrace.dto.v4.CategoryConfigV4.class)));
        when(sql.getTabs()).thenReturn(List.of());

        HealthIndicator indicator = new SearchConfigHealthIndicator(v4, sql);
        Health h = indicator.health();

        assertThat(h.getStatus()).isEqualTo(Status.DOWN);
        assertThat(h.getDetails().get("v4Loaded")).isEqualTo(Boolean.TRUE);
        assertThat(h.getDetails().get("sqlLoaded")).isEqualTo(Boolean.FALSE);
    }

    /**
     * Forward declaration. Plan 07-03 replaces with the real
     * {@code com.citi.gru.rectrace.observability.health.SearchConfigHealthIndicator}.
     */
    static class SearchConfigHealthIndicator implements HealthIndicator {
        private final SearchConfigServiceV4 v4;
        private final SqlSearchConfigServiceV4 sql;

        SearchConfigHealthIndicator(SearchConfigServiceV4 v4, SqlSearchConfigServiceV4 sql) {
            this.v4 = v4;
            this.sql = sql;
        }

        @Override
        public Health health() {
            boolean v4Loaded = v4.getCategories() != null && !v4.getCategories().isEmpty();
            boolean sqlLoaded = sql.getTabs() != null && !sql.getTabs().isEmpty();
            Status status = (v4Loaded && sqlLoaded) ? Status.UP : Status.DOWN;
            return Health.status(status)
                    .withDetail("v4Loaded", v4Loaded)
                    .withDetail("sqlLoaded", sqlLoaded)
                    .build();
        }
    }
}
