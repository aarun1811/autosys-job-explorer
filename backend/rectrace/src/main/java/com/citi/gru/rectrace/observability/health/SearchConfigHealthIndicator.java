package com.citi.gru.rectrace.observability.health;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.AbstractHealthIndicator;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.Status;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import com.citi.gru.rectrace.dto.v4.CategoryConfigV4;
import com.citi.gru.rectrace.dto.v4.SqlTabConfigV4;
import com.citi.gru.rectrace.service.v4.SearchConfigServiceV4;
import com.citi.gru.rectrace.service.v4.SqlSearchConfigServiceV4;

/**
 * Phase 7 / OBS-02 — DOWN when either the JSON-driven {@link SearchConfigServiceV4} or
 * the SQL-tab-driven {@link SqlSearchConfigServiceV4} reports an empty config list.
 *
 * <p>Bean name {@code "searchConfig"} surfaces as {@code $.components.searchConfig} in the
 * default {@code /actuator/health} group. Details record per-service load state
 * ({@code v4Loaded}, {@code sqlLoaded}) for ops triage.
 *
 * <p>Both services are {@code required=false} so the indicator boots in the {@code test}
 * profile where neither service is in the ApplicationContext; in that state both
 * {@code Loaded} flags are false and the aggregate is DOWN — which is the correct signal:
 * "search config has not loaded."
 */
@Component("searchConfig")
public class SearchConfigHealthIndicator extends AbstractHealthIndicator {

    private final SearchConfigServiceV4 v4;
    private final SqlSearchConfigServiceV4 sql;

    @Autowired(required = false)
    public SearchConfigHealthIndicator(@Nullable SearchConfigServiceV4 v4,
                                       @Nullable SqlSearchConfigServiceV4 sql) {
        this.v4 = v4;
        this.sql = sql;
    }

    @Override
    protected void doHealthCheck(Health.Builder builder) {
        boolean v4Loaded = false;
        if (v4 != null) {
            List<CategoryConfigV4> cats = v4.getCategories();
            v4Loaded = cats != null && !cats.isEmpty();
        }
        boolean sqlLoaded = false;
        if (sql != null) {
            List<SqlTabConfigV4> tabs = sql.getTabs();
            sqlLoaded = tabs != null && !tabs.isEmpty();
        }
        Status status = (v4Loaded && sqlLoaded) ? Status.UP : Status.DOWN;
        builder.status(status)
                .withDetail("v4Loaded", v4Loaded)
                .withDetail("sqlLoaded", sqlLoaded);
    }
}
