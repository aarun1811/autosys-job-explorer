package com.citi.gru.rectrace.loader.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.citi.gru.rectrace.loader.LoaderConfigService;
import com.citi.gru.rectrace.loader.LoaderRunHistoryService;
import com.citi.gru.rectrace.loader.LoaderTicker;
import com.citi.gru.rectrace.loader.dto.LoaderJobDefV4;
import com.citi.gru.rectrace.loader.dto.LoaderRunRecordV4;
import com.citi.gru.rectrace.loader.dto.LoaderRunStatus;
import com.citi.gru.rectrace.loader.dto.LoaderTargetConfigV4;

import net.javacrumbs.shedlock.core.LockingTaskExecutor.TaskResult;

/**
 * Phase 6 / LOADER-08 — controller-slice test for {@link LoaderAdminControllerV4}.
 *
 * <p>Uses {@code @WebMvcTest} (controller slice only — no full context, no datasource, no
 * Elasticsearch client) with {@code @MockBean} for the three injected services. Activates the
 * {@code "slice"} profile (not the {@code "test"} profile used by {@code ContextLoadsTest}) so
 * the {@code @Profile("!test")} guard on {@link LoaderAdminControllerV4} does not strip the
 * controller from the slice context.
 *
 * <p>The Wave-0 @Disabled scaffold (Plan 06-02) is replaced verbatim here; Plan 06-05 enables
 * all six methods.
 */
@WebMvcTest(controllers = LoaderAdminControllerV4.class)
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("slice")
class LoaderAdminControllerV4Test {

    private static final String JOB_KEY = "rectrace_core_loader";
    private static final String JOB_ALIAS = "rectrace_core_alias";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private LoaderConfigService loaderConfig;

    @MockBean
    private LoaderRunHistoryService runHistory;

    @MockBean
    private LoaderTicker ticker;

    private LoaderJobDefV4 def;

    @BeforeEach
    void setup() {
        LoaderTargetConfigV4 target = new LoaderTargetConfigV4();
        target.setAlias(JOB_ALIAS);
        def = new LoaderJobDefV4();
        def.setKey(JOB_KEY);
        def.setSchedule("0 */5 * * * *");
        def.setTimezone("UTC");
        def.setTarget(target);
    }

    @Test
    void getJobsReturns200WithJobList() throws Exception {
        LoaderRunRecordV4 lastSuccess = newRecord(LoaderRunStatus.SUCCESS, Instant.now());
        when(loaderConfig.getJobs()).thenReturn(List.of(def));
        when(runHistory.lastN(JOB_KEY, 1)).thenReturn(List.of(lastSuccess));

        mockMvc.perform(get("/api/v4/loader-admin/jobs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].key").value(JOB_KEY))
                .andExpect(jsonPath("$[0].alias").value(JOB_ALIAS))
                .andExpect(jsonPath("$[0].schedule").value("0 */5 * * * *"))
                .andExpect(jsonPath("$[0].timezone").value("UTC"))
                .andExpect(jsonPath("$[0].lastRun.status").value("SUCCESS"));
    }

    @Test
    void runNowReturns200WhenLockAvailable() throws Exception {
        TaskResult<Void> executed = mockTaskResult(true);
        LoaderRunRecordV4 justRan = newRecord(LoaderRunStatus.SUCCESS, Instant.now());
        when(loaderConfig.getJob(JOB_KEY)).thenReturn(Optional.of(def));
        when(ticker.runNow(any(LoaderJobDefV4.class))).thenReturn(executed);
        when(runHistory.lastN(JOB_KEY, 1)).thenReturn(List.of(justRan));

        mockMvc.perform(post("/api/v4/loader-admin/jobs/{key}/run-now", JOB_KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.jobKey").value(JOB_KEY));
    }

    @Test
    void runNowReturns409WhenLockHeld() throws Exception {
        TaskResult<Void> notExecuted = mockTaskResult(false);
        LoaderRunRecordV4 inFlight = newRecord(LoaderRunStatus.RUNNING, Instant.now());
        when(loaderConfig.getJob(JOB_KEY)).thenReturn(Optional.of(def));
        when(ticker.runNow(any(LoaderJobDefV4.class))).thenReturn(notExecuted);
        when(runHistory.lastN(eq(JOB_KEY), anyInt())).thenReturn(List.of(inFlight));

        mockMvc.perform(post("/api/v4/loader-admin/jobs/{key}/run-now", JOB_KEY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.reason").value("scheduled run in flight"))
                .andExpect(jsonPath("$.currentRun.status").value("RUNNING"));
    }

    @Test
    void runNowReturns404ForUnknownJobKey() throws Exception {
        when(loaderConfig.getJob("does-not-exist")).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/v4/loader-admin/jobs/{key}/run-now", "does-not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error_type").value("UNKNOWN_JOB"))
                .andExpect(jsonPath("$.status").value("error"));
    }

    @Test
    void runsReturnsLast20ForJob() throws Exception {
        List<LoaderRunRecordV4> twenty = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            twenty.add(newRecord(LoaderRunStatus.SUCCESS, Instant.now().minusSeconds(i * 60L)));
        }
        when(loaderConfig.getJob(JOB_KEY)).thenReturn(Optional.of(def));
        when(runHistory.lastN(JOB_KEY, 20)).thenReturn(twenty);

        mockMvc.perform(get("/api/v4/loader-admin/jobs/{key}/runs", JOB_KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(20))
                .andExpect(jsonPath("$[0].jobKey").value(JOB_KEY));
    }

    @Test
    void runsReturns404ForUnknownJobKey() throws Exception {
        when(loaderConfig.getJob("nope")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v4/loader-admin/jobs/{key}/runs", "nope"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error_type").value("UNKNOWN_JOB"));
    }

    // ------------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------------

    private LoaderRunRecordV4 newRecord(LoaderRunStatus status, Instant startedAt) {
        LoaderRunRecordV4 r = new LoaderRunRecordV4();
        r.setJobKey(JOB_KEY);
        r.setStatus(status);
        r.setStartedAt(startedAt);
        if (status == LoaderRunStatus.SUCCESS) {
            r.setFinishedAt(startedAt.plusSeconds(1));
            r.setRowCount(5L);
            r.setDurationMs(1000L);
        }
        return r;
    }

    /**
     * {@code TaskResult} factories ({@code result(T)} and {@code notExecuted()}) are
     * package-private in shedlock-core 7.7.0 — we can't construct one directly across
     * package boundaries, so we mock the class itself and stub {@code wasExecuted()}.
     */
    @SuppressWarnings("unchecked")
    private TaskResult<Void> mockTaskResult(boolean executed) {
        TaskResult<Void> result = mock(TaskResult.class);
        when(result.wasExecuted()).thenReturn(executed);
        return result;
    }
}
