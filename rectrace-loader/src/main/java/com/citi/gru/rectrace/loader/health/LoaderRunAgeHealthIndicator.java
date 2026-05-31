package com.citi.gru.rectrace.loader.health;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.AbstractHealthIndicator;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.Status;
import org.springframework.lang.Nullable;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Component;

import com.citi.gru.rectrace.loader.LoaderConfigService;
import com.citi.gru.rectrace.loader.LoaderRunHistoryService;
import com.citi.gru.rectrace.loader.dto.LoaderJobDefV4;
import com.citi.gru.rectrace.loader.dto.LoaderRunRecordV4;
import com.citi.gru.rectrace.loader.dto.LoaderRunStatus;

/**
 * Phase 7 / OBS-02 — per-loader-job staleness probe. Reports DOWN when any configured
 * loader job's last-successful-run age exceeds 2× its cron interval (D-7.12).
 *
 * <p>Bean name {@code loaderRunAge} is the contributor name in the default
 * {@code /actuator/health} aggregate. The dedicated
 * {@code management.endpoint.health.group.loader} group is intentionally deferred
 * (Phase 7 Pitfall P-11 / D-7.12) — the indicator contributes to the default group only.
 * See the comment block above the management-endpoints stanza in
 * {@code rectrace-loader/src/main/resources/application.properties} for the deferral
 * rationale.
 *
 * <p>The indicator iterates {@link LoaderConfigService#getJobs()} and for each job:
 * <ul>
 *   <li>Looks up the most-recent {@link LoaderRunStatus#SUCCESS} timestamp via
 *       {@link LoaderRunHistoryService#lastN(String, int)}.</li>
 *   <li>Parses the job's cron string and computes the interval between
 *       {@code now} and the next fire as the reference period.</li>
 *   <li>If age &gt; 2 × cron-interval (or no successful run on record) the per-job status
 *       flips to DOWN and the aggregate becomes DOWN.</li>
 * </ul>
 *
 * <p>All three dependencies are {@code required=false} so the indicator can boot in the
 * {@code test} profile where {@link LoaderConfigService} / {@link LoaderRunHistoryService}
 * are {@code @Profile("!test")}. The integration test then sees an UP indicator with
 * {@code jobs: "none configured"}, which is the documented "no jobs to monitor" state.
 */
@Component("loaderRunAge")
public class LoaderRunAgeHealthIndicator extends AbstractHealthIndicator {

    private final LoaderConfigService loaderConfig;
    private final LoaderRunHistoryService runHistory;
    private final Clock clock;

    @Autowired(required = false)
    public LoaderRunAgeHealthIndicator(@Nullable LoaderConfigService loaderConfig,
                                       @Nullable LoaderRunHistoryService runHistory,
                                       @Nullable Clock clock) {
        this.loaderConfig = loaderConfig;
        this.runHistory = runHistory;
        this.clock = clock != null ? clock : Clock.systemUTC();
    }

    @Override
    protected void doHealthCheck(Health.Builder builder) {
        if (loaderConfig == null || runHistory == null) {
            builder.up().withDetail("jobs", "none configured");
            return;
        }
        List<LoaderJobDefV4> jobs = loaderConfig.getJobs();
        if (jobs == null || jobs.isEmpty()) {
            builder.up().withDetail("jobs", "none configured");
            return;
        }
        Instant now = clock.instant();
        Status overall = Status.UP;
        for (LoaderJobDefV4 def : jobs) {
            String key = def.getKey();
            Duration cronInterval = computeCronInterval(def, now);
            Instant lastSuccess = findLastSuccess(key);
            long ageMs = lastSuccess == null
                    ? Long.MAX_VALUE
                    : now.toEpochMilli() - lastSuccess.toEpochMilli();
            String perJobStatus = (cronInterval == null
                    || ageMs > 2L * cronInterval.toMillis())
                    ? "DOWN"
                    : "UP";
            if ("DOWN".equals(perJobStatus)) {
                overall = Status.DOWN;
            }
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("lastSuccess", lastSuccess == null ? "never" : lastSuccess.toString());
            detail.put("ageMs", ageMs);
            detail.put("status", perJobStatus);
            builder.withDetail(key, detail);
        }
        builder.status(overall);
    }

    private Duration computeCronInterval(LoaderJobDefV4 def, Instant now) {
        try {
            CronExpression cron = CronExpression.parse(def.getSchedule());
            ZoneId zone = def.getTimezone() != null
                    ? ZoneId.of(def.getTimezone())
                    : ZoneId.of("UTC");
            ZonedDateTime nowZ = now.atZone(zone);
            ZonedDateTime next = cron.next(nowZ);
            if (next == null) {
                return null;
            }
            return Duration.between(nowZ, next);
        } catch (Exception e) {
            return null;
        }
    }

    private Instant findLastSuccess(String jobKey) {
        try {
            List<LoaderRunRecordV4> rows = runHistory.lastN(jobKey, 20);
            if (rows == null) {
                return null;
            }
            for (LoaderRunRecordV4 r : rows) {
                if (r.getStatus() == LoaderRunStatus.SUCCESS) {
                    return r.getFinishedAt() != null ? r.getFinishedAt() : r.getStartedAt();
                }
            }
            return null;
        } catch (Exception e) {
            return null;
        }
    }
}
