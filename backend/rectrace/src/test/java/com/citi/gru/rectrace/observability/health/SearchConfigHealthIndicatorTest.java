package com.citi.gru.rectrace.observability.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.Status;

import com.citi.gru.rectrace.dto.v4.CategoryConfigV4;
import com.citi.gru.rectrace.dto.v4.SqlTabConfigV4;
import com.citi.gru.rectrace.service.v4.SearchConfigServiceV4;
import com.citi.gru.rectrace.service.v4.SqlSearchConfigServiceV4;

/**
 * OBS-02 contract — {@link SearchConfigHealthIndicator} is DOWN if either the
 * JSON-driven {@link SearchConfigServiceV4} or the SQL-driven
 * {@link SqlSearchConfigServiceV4} reports an empty list. Detail map records
 * per-service load state ({@code v4Loaded}, {@code sqlLoaded}).
 */
class SearchConfigHealthIndicatorTest {

    @Test
    void upWhenBothServicesReportNonEmptyCategories() {
        SearchConfigServiceV4 v4 = mock(SearchConfigServiceV4.class);
        SqlSearchConfigServiceV4 sql = mock(SqlSearchConfigServiceV4.class);
        when(v4.getCategories()).thenReturn(List.of(mock(CategoryConfigV4.class)));
        when(sql.getTabs()).thenReturn(List.of(mock(SqlTabConfigV4.class)));

        SearchConfigHealthIndicator indicator = new SearchConfigHealthIndicator(v4, sql);
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
        when(sql.getTabs()).thenReturn(List.of(mock(SqlTabConfigV4.class)));

        SearchConfigHealthIndicator indicator = new SearchConfigHealthIndicator(v4, sql);
        Health h = indicator.health();

        assertThat(h.getStatus()).isEqualTo(Status.DOWN);
        assertThat(h.getDetails().get("v4Loaded")).isEqualTo(Boolean.FALSE);
        assertThat(h.getDetails().get("sqlLoaded")).isEqualTo(Boolean.TRUE);
    }

    @Test
    void downWhenSqlEmpty() {
        SearchConfigServiceV4 v4 = mock(SearchConfigServiceV4.class);
        SqlSearchConfigServiceV4 sql = mock(SqlSearchConfigServiceV4.class);
        when(v4.getCategories()).thenReturn(List.of(mock(CategoryConfigV4.class)));
        when(sql.getTabs()).thenReturn(List.of());

        SearchConfigHealthIndicator indicator = new SearchConfigHealthIndicator(v4, sql);
        Health h = indicator.health();

        assertThat(h.getStatus()).isEqualTo(Status.DOWN);
        assertThat(h.getDetails().get("v4Loaded")).isEqualTo(Boolean.TRUE);
        assertThat(h.getDetails().get("sqlLoaded")).isEqualTo(Boolean.FALSE);
    }

    @Test
    void downWhenBothServicesMissing() {
        SearchConfigHealthIndicator indicator = new SearchConfigHealthIndicator(null, null);
        Health h = indicator.health();

        assertThat(h.getStatus()).isEqualTo(Status.DOWN);
        assertThat(h.getDetails().get("v4Loaded")).isEqualTo(Boolean.FALSE);
        assertThat(h.getDetails().get("sqlLoaded")).isEqualTo(Boolean.FALSE);
    }
}
