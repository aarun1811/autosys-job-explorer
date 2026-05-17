package com.citi.gru.rectrace.controller.v4;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.fail;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

/**
 * Phase 6 / LOADER-08 — Wave-0 contract scaffold for the loader admin REST API.
 *
 * <p>Wave-0 scaffold per Plan 06-02. All methods @Disabled until Plan 06-05 enables this class.
 *
 * <p>The target controller {@code com.citi.gru.rectrace.controller.v4.LoaderAdminControllerV4}
 * is introduced by Plan 06-05 and exposes:
 * <ul>
 *   <li>{@code GET  /api/v4/loader/jobs} — list configured loader jobs.</li>
 *   <li>{@code POST /api/v4/loader/jobs/{jobKey}/run-now} — trigger an immediate run, honoring
 *       the same ShedLock mutex as the scheduled trigger (returns 409 if the scheduled run is
 *       in flight — Decision D-6.14).</li>
 *   <li>{@code GET  /api/v4/loader/jobs/{jobKey}/runs} — return the last 20 run records.</li>
 * </ul>
 *
 * <p>Plan 06-05 enables this class with {@code @WebMvcTest(LoaderAdminControllerV4.class)} +
 * {@code @MockBean} for the underlying {@code LoaderConfigService}, {@code LoaderRunHistoryService},
 * and {@code LockingTaskExecutor}. The {@code @Profile("!test")}-gated loader infrastructure
 * is bypassed entirely in {@code @WebMvcTest} (controller-slice only — no full context).
 */
@Disabled("Wave 0 / Plan 06-02 — enabled when LoaderAdminControllerV4 lands in Plan 06-05")
class LoaderAdminControllerV4Test {

    @Test
    void getJobsReturns200WithJobList() {
        // Plan 06-05: when(loaderConfigService.getJobs()).thenReturn(List.of(jobA, jobB));
        // mockMvc.perform(get("/api/v4/loader/jobs")).andExpect(status().isOk())
        //        .andExpect(jsonPath("$[*].key", containsInAnyOrder("jobA","jobB")));
        fail("LOADER-08: GET /api/v4/loader/jobs must return 200 with the configured job list");
    }

    @Test
    void runNowReturns200WhenLockAvailable() {
        // Plan 06-05: when(lockingTaskExecutor.executeWithLock(any(Runnable.class), any())).thenReturn(result-with-wasExecuted-true);
        // mockMvc.perform(post("/api/v4/loader/jobs/jobA/run-now")).andExpect(status().isOk());
        fail("LOADER-08: POST run-now must return 200 when ShedLock acquires");
    }

    @Test
    void runNowReturns409WhenLockHeld() {
        // Plan 06-05 / Decision D-6.14: when wasExecuted=false (scheduled run holding the lock),
        // controller must return 409 Conflict with body {"reason": "scheduled run in flight"}.
        // mockMvc.perform(post("/api/v4/loader/jobs/jobA/run-now"))
        //        .andExpect(status().isConflict())
        //        .andExpect(jsonPath("$.reason").value("scheduled run in flight"));
        assertThat(false).as("LOADER-08 / D-6.14: 409 + 'scheduled run in flight' when lock held").isTrue();
    }

    @Test
    void runNowReturns404ForUnknownJobKey() {
        // Plan 06-05: mockMvc.perform(post("/api/v4/loader/jobs/does-not-exist/run-now"))
        //                    .andExpect(status().isNotFound());
        fail("LOADER-08: POST run-now for unknown job_key must return 404");
    }

    @Test
    void runsReturnsLast20ForJob() {
        // Plan 06-05: when(loaderRunHistoryService.lastN("jobA", 20)).thenReturn(20-records-list);
        // mockMvc.perform(get("/api/v4/loader/jobs/jobA/runs")).andExpect(status().isOk())
        //        .andExpect(jsonPath("$.length()").value(20));
        fail("LOADER-08: GET /jobs/{key}/runs must return the last 20 records");
    }
}
