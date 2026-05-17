package com.citi.gru.rectrace.observability.health;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Map;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.actuate.health.Status;

/**
 * OBS-02 contract — {@code LoaderRunAgeHealthIndicator} is DOWN when any
 * configured loader job's last-successful-run age exceeds 2× its cron interval
 * (D-7.12). The per-job detail map carries {@code lastSuccess / ageMs / status}.
 * Plan 07-03 wires the real {@code LoaderRunHistoryService} +
 * {@code LoaderJobRegistry} dependencies and removes the {@link Disabled}.
 */
@Disabled("Wave 0 scaffold — enabled by Plan 07-03")
class LoaderRunAgeHealthIndicatorTest {

    private static final long FIVE_MIN_MS = 5 * 60 * 1000L;

    @Test
    void upWhenLastSuccessYoungerThanTwoCronIntervals() {
        Instant now = Instant.parse("2026-05-17T12:00:00Z");
        Clock clock = Clock.fixed(now, ZoneId.of("UTC"));

        FakeRegistry registry = new FakeRegistry("core_load", "0 */5 * * * *", FIVE_MIN_MS);
        FakeHistory history = new FakeHistory(Map.of("core_load", now.minusMillis(3 * 60 * 1000L)));

        HealthIndicator indicator = new LoaderRunAgeHealthIndicator(history, registry, clock);
        Health h = indicator.health();

        assertThat(h.getStatus()).isEqualTo(Status.UP);
        @SuppressWarnings("unchecked")
        Map<String, Object> coreLoad = (Map<String, Object>) h.getDetails().get("core_load");
        assertThat(coreLoad).containsKeys("lastSuccess", "ageMs", "status");
        assertThat(coreLoad.get("status")).isEqualTo("UP");
    }

    @Test
    void downWhenLastSuccessOlderThanTwoCronIntervals() {
        Instant now = Instant.parse("2026-05-17T12:00:00Z");
        Clock clock = Clock.fixed(now, ZoneId.of("UTC"));

        FakeRegistry registry = new FakeRegistry("core_load", "0 */5 * * * *", FIVE_MIN_MS);
        FakeHistory history = new FakeHistory(Map.of("core_load", now.minusMillis(20 * 60 * 1000L)));

        HealthIndicator indicator = new LoaderRunAgeHealthIndicator(history, registry, clock);
        Health h = indicator.health();

        assertThat(h.getStatus()).isEqualTo(Status.DOWN);
        @SuppressWarnings("unchecked")
        Map<String, Object> coreLoad = (Map<String, Object>) h.getDetails().get("core_load");
        assertThat(coreLoad.get("status")).isEqualTo("DOWN");
    }

    // ---- Plan 07-03 deletes everything below and wires real beans instead. ----

    interface FakeRegistryApi {
        Map<String, Long> intervalMsByJob();
    }

    interface FakeHistoryApi {
        Map<String, Instant> lastSuccessByJob();
    }

    static class FakeRegistry implements FakeRegistryApi {
        private final Map<String, Long> intervals;

        FakeRegistry(String jobKey, String cronUnused, long intervalMs) {
            this.intervals = Map.of(jobKey, intervalMs);
        }

        @Override
        public Map<String, Long> intervalMsByJob() {
            return intervals;
        }
    }

    static class FakeHistory implements FakeHistoryApi {
        private final Map<String, Instant> lastSuccess;

        FakeHistory(Map<String, Instant> lastSuccess) {
            this.lastSuccess = lastSuccess;
        }

        @Override
        public Map<String, Instant> lastSuccessByJob() {
            return lastSuccess;
        }
    }

    /**
     * Forward-declared scaffold indicator. Plan 07-03 replaces this with the
     * real {@code LoaderRunAgeHealthIndicator(LoaderRunHistoryService,
     * LoaderJobRegistry, Clock)} from main sources.
     */
    static class LoaderRunAgeHealthIndicator implements HealthIndicator {
        private final FakeHistoryApi history;
        private final FakeRegistryApi registry;
        private final Clock clock;

        LoaderRunAgeHealthIndicator(FakeHistoryApi history, FakeRegistryApi registry, Clock clock) {
            this.history = history;
            this.registry = registry;
            this.clock = clock;
        }

        @Override
        public Health health() {
            Health.Builder builder = Health.up();
            Status overall = Status.UP;
            Map<String, Instant> lasts = history.lastSuccessByJob();
            Map<String, Long> intervals = registry.intervalMsByJob();
            Instant now = clock.instant();
            for (Map.Entry<String, Long> entry : intervals.entrySet()) {
                String job = entry.getKey();
                long intervalMs = entry.getValue();
                Instant lastSuccess = lasts.get(job);
                long ageMs = lastSuccess == null ? Long.MAX_VALUE
                        : now.toEpochMilli() - lastSuccess.toEpochMilli();
                String perJobStatus = ageMs > 2 * intervalMs ? "DOWN" : "UP";
                if ("DOWN".equals(perJobStatus)) {
                    overall = Status.DOWN;
                }
                builder.withDetail(job, Map.of(
                        "lastSuccess", lastSuccess == null ? "never" : lastSuccess.toString(),
                        "ageMs", ageMs,
                        "status", perJobStatus));
            }
            return builder.status(overall).build();
        }
    }
}
