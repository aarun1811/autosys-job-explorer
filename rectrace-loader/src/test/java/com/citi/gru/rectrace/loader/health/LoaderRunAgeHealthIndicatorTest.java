package com.citi.gru.rectrace.loader.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.Status;

import com.citi.gru.rectrace.loader.LoaderConfigService;
import com.citi.gru.rectrace.loader.LoaderRunHistoryService;
import com.citi.gru.rectrace.loader.dto.LoaderJobDefV4;
import com.citi.gru.rectrace.loader.dto.LoaderRunRecordV4;
import com.citi.gru.rectrace.loader.dto.LoaderRunStatus;

/**
 * OBS-02 contract — {@link LoaderRunAgeHealthIndicator} is DOWN when any configured
 * loader job's last-successful-run age exceeds 2× its cron interval (D-7.12). The
 * per-job detail map carries {@code lastSuccess / ageMs / status}.
 *
 * <p>Plan 07-03 swapped the Plan-01 scaffold's {@code FakeRegistry}/{@code FakeHistory}
 * interfaces for Mockito-mocks of the real {@link LoaderConfigService} +
 * {@link LoaderRunHistoryService} — those services own the cron string and run-history
 * lookup respectively, and the scaffold pre-dates the cron-driven implementation.
 */
class LoaderRunAgeHealthIndicatorTest {

    private static LoaderJobDefV4 jobWithCron(String key, String cron) {
        LoaderJobDefV4 def = new LoaderJobDefV4();
        def.setKey(key);
        def.setSchedule(cron);
        def.setTimezone("UTC");
        return def;
    }

    private static LoaderRunRecordV4 successAt(String jobKey, Instant when) {
        LoaderRunRecordV4 rec = new LoaderRunRecordV4();
        rec.setJobKey(jobKey);
        rec.setStartedAt(when);
        rec.setFinishedAt(when);
        rec.setStatus(LoaderRunStatus.SUCCESS);
        return rec;
    }

    @Test
    void upWhenLastSuccessYoungerThanTwoCronIntervals() {
        Instant now = Instant.parse("2026-05-17T12:02:00Z");
        Clock clock = Clock.fixed(now, ZoneId.of("UTC"));

        LoaderConfigService config = mock(LoaderConfigService.class);
        LoaderRunHistoryService history = mock(LoaderRunHistoryService.class);
        when(config.getJobs()).thenReturn(List.of(jobWithCron("core_load", "0 */5 * * * *")));
        when(history.lastN(eq("core_load"), anyInt()))
                .thenReturn(List.of(successAt("core_load", now.minusMillis(3 * 60 * 1000L))));

        LoaderRunAgeHealthIndicator indicator =
                new LoaderRunAgeHealthIndicator(config, history, clock);
        Health h = indicator.health();

        assertThat(h.getStatus()).isEqualTo(Status.UP);
        @SuppressWarnings("unchecked")
        Map<String, Object> coreLoad = (Map<String, Object>) h.getDetails().get("core_load");
        assertThat(coreLoad).containsKeys("lastSuccess", "ageMs", "status");
        assertThat(coreLoad.get("status")).isEqualTo("UP");
    }

    @Test
    void downWhenLastSuccessOlderThanTwoCronIntervals() {
        Instant now = Instant.parse("2026-05-17T12:02:00Z");
        Clock clock = Clock.fixed(now, ZoneId.of("UTC"));

        LoaderConfigService config = mock(LoaderConfigService.class);
        LoaderRunHistoryService history = mock(LoaderRunHistoryService.class);
        when(config.getJobs()).thenReturn(List.of(jobWithCron("core_load", "0 */5 * * * *")));
        when(history.lastN(eq("core_load"), anyInt()))
                .thenReturn(List.of(successAt("core_load", now.minusMillis(20 * 60 * 1000L))));

        LoaderRunAgeHealthIndicator indicator =
                new LoaderRunAgeHealthIndicator(config, history, clock);
        Health h = indicator.health();

        assertThat(h.getStatus()).isEqualTo(Status.DOWN);
        @SuppressWarnings("unchecked")
        Map<String, Object> coreLoad = (Map<String, Object>) h.getDetails().get("core_load");
        assertThat(coreLoad.get("status")).isEqualTo("DOWN");
    }

    @Test
    void downWhenNoSuccessOnRecord() {
        Instant now = Instant.parse("2026-05-17T12:02:00Z");
        Clock clock = Clock.fixed(now, ZoneId.of("UTC"));

        LoaderConfigService config = mock(LoaderConfigService.class);
        LoaderRunHistoryService history = mock(LoaderRunHistoryService.class);
        when(config.getJobs()).thenReturn(List.of(jobWithCron("core_load", "0 */5 * * * *")));
        when(history.lastN(eq("core_load"), anyInt())).thenReturn(List.of());

        LoaderRunAgeHealthIndicator indicator =
                new LoaderRunAgeHealthIndicator(config, history, clock);
        Health h = indicator.health();

        assertThat(h.getStatus()).isEqualTo(Status.DOWN);
        @SuppressWarnings("unchecked")
        Map<String, Object> coreLoad = (Map<String, Object>) h.getDetails().get("core_load");
        assertThat(coreLoad.get("lastSuccess")).isEqualTo("never");
        assertThat(coreLoad.get("status")).isEqualTo("DOWN");
    }

    @Test
    void upWithNoConfiguredJobs() {
        LoaderConfigService config = mock(LoaderConfigService.class);
        LoaderRunHistoryService history = mock(LoaderRunHistoryService.class);
        when(config.getJobs()).thenReturn(List.of());

        LoaderRunAgeHealthIndicator indicator =
                new LoaderRunAgeHealthIndicator(config, history, Clock.systemUTC());
        Health h = indicator.health();

        assertThat(h.getStatus()).isEqualTo(Status.UP);
        assertThat(h.getDetails()).containsEntry("jobs", "none configured");
    }

    @Test
    void upWhenLoaderInfrastructureMissing() {
        LoaderRunAgeHealthIndicator indicator =
                new LoaderRunAgeHealthIndicator(null, null, Clock.systemUTC());
        Health h = indicator.health();

        assertThat(h.getStatus()).isEqualTo(Status.UP);
        assertThat(h.getDetails()).containsEntry("jobs", "none configured");
    }
}
