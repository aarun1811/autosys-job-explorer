package com.citi.gru.rectrace.controller.v4;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.citi.gru.rectrace.constants.AppConstants;
import com.citi.gru.rectrace.dto.v4.LoaderJobSummaryV4;
import com.citi.gru.rectrace.dto.v4.RunNowConflictResponseV4;
import com.citi.gru.rectrace.loader.LoaderConfigService;
import com.citi.gru.rectrace.loader.LoaderRunHistoryService;
import com.citi.gru.rectrace.loader.LoaderTicker;
import com.citi.gru.rectrace.loader.dto.LoaderJobDefV4;
import com.citi.gru.rectrace.loader.dto.LoaderRunRecordV4;
import com.citi.gru.rectrace.loader.dto.LoaderRunStatus;

import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.core.LockingTaskExecutor.TaskResult;

/**
 * Phase 6 / LOADER-08 — admin REST surface for the ES loader subsystem.
 *
 * <ul>
 *   <li>{@code GET  /api/v4/loader-admin/jobs}                       — list configured loader
 *       jobs (key + alias + cron + last-run summary).</li>
 *   <li>{@code POST /api/v4/loader-admin/jobs/{key}/run-now}         — trigger an immediate run.
 *       Returns 200 + the just-completed run record when the lock is acquired, 409 +
 *       {@link RunNowConflictResponseV4} when the scheduled run holds the lock (D-6.14), 404
 *       for an unknown job key.</li>
 *   <li>{@code GET  /api/v4/loader-admin/jobs/{key}/runs}            — last 20 run records,
 *       newest first (LOADER-07/08).</li>
 * </ul>
 *
 * <p>Mirrors {@link SqlSearchControllerV4}: {@code @Profile("!test")},
 * {@code @CrossOrigin(origins = "*")}, {@code x-citiportal-loginid} header (D-6.13 — Phase 9
 * will gate; Phase 6 only logs), standardized {@code createErrorResponse(...)}.
 *
 * <p>06-RESEARCH.md Pitfall L8 — the conflict path returns 409 (not 202): the admin user
 * needs to know the run did NOT happen so they can decide whether to retry.
 */
@Profile("!test")
@RestController
@RequestMapping("/api/v4/loader-admin")
@CrossOrigin(origins = "*")
@Slf4j
public class LoaderAdminControllerV4 {

    private final LoaderConfigService loaderConfig;
    private final LoaderRunHistoryService runHistory;
    private final LoaderTicker ticker;

    public LoaderAdminControllerV4(
            LoaderConfigService loaderConfig,
            LoaderRunHistoryService runHistory,
            LoaderTicker ticker) {
        this.loaderConfig = loaderConfig;
        this.runHistory = runHistory;
        this.ticker = ticker;
    }

    /**
     * LOADER-08 — list all configured loader jobs with a compact view of the most-recent run.
     * Returns an empty list (never throws) when no jobs are configured.
     */
    @GetMapping("/jobs")
    public ResponseEntity<List<LoaderJobSummaryV4>> listJobs(
            @RequestHeader(value = AppConstants.CITI_PORTAL_LOGIN_ID_HEADER, required = false) String loginId) {
        log.info("User [{}] requested loader admin job list", loginId);
        List<LoaderJobDefV4> defs = loaderConfig.getJobs();
        List<LoaderJobSummaryV4> out = new ArrayList<>(defs.size());
        for (LoaderJobDefV4 def : defs) {
            LoaderJobSummaryV4 summary = new LoaderJobSummaryV4();
            summary.setKey(def.getKey());
            summary.setAlias(def.getTarget() == null ? null : def.getTarget().getAlias());
            summary.setSchedule(def.getSchedule());
            summary.setTimezone(def.getTimezone());
            List<LoaderRunRecordV4> recent = runHistory.lastN(def.getKey(), 1);
            if (recent != null && !recent.isEmpty()) {
                summary.setLastRun(recent.get(0));
            }
            out.add(summary);
        }
        return ResponseEntity.ok(out);
    }

    /**
     * LOADER-08 / D-6.14 — trigger an immediate run.
     *
     * <ul>
     *   <li>404 UNKNOWN_JOB when {@code key} is not in the configured job map.</li>
     *   <li>200 + the just-completed {@link LoaderRunRecordV4} (SUCCESS or FAILED) when the
     *       ShedLock acquires.</li>
     *   <li>409 + {@link RunNowConflictResponseV4} ({@code reason = "scheduled run in flight"}
     *       + the in-flight RUNNING record if present) when ShedLock reports
     *       {@code wasExecuted() == false}.</li>
     *   <li>500 INTERNAL when the lock provider itself throws (the job body has its own
     *       try/catch in Plan 04 and writes FAILED — that is reported as 200 + a FAILED
     *       record, not 500).</li>
     * </ul>
     */
    @PostMapping("/jobs/{key}/run-now")
    public ResponseEntity<?> runNow(
            @PathVariable String key,
            @RequestHeader(value = AppConstants.CITI_PORTAL_LOGIN_ID_HEADER, required = false) String loginId) {
        log.info("User [{}] requested run-now for loader job [{}]", loginId, key);

        Optional<LoaderJobDefV4> defOpt = loaderConfig.getJob(key);
        if (defOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(createErrorResponse("UNKNOWN_JOB", "Unknown loader job: " + key));
        }

        try {
            TaskResult<Void> result = ticker.runNow(defOpt.get());
            if (result != null && result.wasExecuted()) {
                List<LoaderRunRecordV4> recent = runHistory.lastN(key, 1);
                LoaderRunRecordV4 body = (recent == null || recent.isEmpty()) ? null : recent.get(0);
                return ResponseEntity.ok(body);
            }
            // Lock held by the scheduled run — D-6.14.
            RunNowConflictResponseV4 conflict = new RunNowConflictResponseV4();
            List<LoaderRunRecordV4> recent = runHistory.lastN(key, 1);
            if (recent != null && !recent.isEmpty()
                    && recent.get(0).getStatus() == LoaderRunStatus.RUNNING) {
                conflict.setCurrentRun(recent.get(0));
            }
            return ResponseEntity.status(HttpStatus.CONFLICT).body(conflict);
        } catch (Throwable t) {
            log.error("run-now dispatch failed for [{}]", key, t);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("INTERNAL", "Run-now dispatch failed"));
        }
    }

    /**
     * LOADER-08 — return the 20 most-recent run records for {@code key} in
     * {@code started_at DESC} order. 404 if the job key is not configured.
     */
    @GetMapping("/jobs/{key}/runs")
    public ResponseEntity<?> getRuns(
            @PathVariable String key,
            @RequestHeader(value = AppConstants.CITI_PORTAL_LOGIN_ID_HEADER, required = false) String loginId) {
        log.info("User [{}] requested run history for loader job [{}]", loginId, key);
        if (loaderConfig.getJob(key).isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(createErrorResponse("UNKNOWN_JOB", "Unknown loader job: " + key));
        }
        return ResponseEntity.ok(runHistory.lastN(key, 20));
    }

    /**
     * Standardized error response per CLAUDE.md Error Response Format. Mirrors the
     * two-arg helper in {@link SqlSearchControllerV4} so the React admin UI can deserialize
     * uniformly across the v4 surface.
     */
    private Map<String, Object> createErrorResponse(String errorType, String message) {
        Map<String, Object> error = new HashMap<>();
        error.put("status", "error");
        error.put("error_type", errorType);
        error.put("message", message);
        error.put("timestamp", System.currentTimeMillis());
        return error;
    }
}
