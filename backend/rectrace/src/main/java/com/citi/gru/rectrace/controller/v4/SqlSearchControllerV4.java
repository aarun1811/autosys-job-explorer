package com.citi.gru.rectrace.controller.v4;

import java.util.HashMap;
import java.util.Map;

import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.citi.gru.rectrace.constants.AppConstants;
import com.citi.gru.rectrace.dto.v4.SSRMRequestV4;
import com.citi.gru.rectrace.dto.v4.SSRMResponseV4;
import com.citi.gru.rectrace.dto.v4.SqlSearchConfigV4;
import com.citi.gru.rectrace.service.v4.SqlQueryServiceV4;
import com.citi.gru.rectrace.service.v4.SqlSearchConfigServiceV4;

import lombok.extern.slf4j.Slf4j;

/**
 * Phase 5 / SQL-04 + SQL-05 + SQL-06 — REST surface for config-driven SQL tabs.
 *
 * <ul>
 *   <li>{@code GET  /api/v4/sql-search/config}        — returns {@code {"tabs": [...]}}</li>
 *   <li>{@code POST /api/v4/sql-search/ssrm/{tabKey}} — SSRM-shaped {@code {rows, lastRow}}</li>
 * </ul>
 *
 * <p>Mirrors {@link SearchControllerV4}: {@code @Profile("!test")},
 * {@code @CrossOrigin(origins = "*")}, {@code x-citiportal-loginid} header (Phase 9 will
 * gate; Phase 5 only logs for parity), standardized error response.
 *
 * <p>Page-size cap (1000) is a controller-level belt-and-suspenders to the executor's
 * {@code setMaxRows} — threat T-05-15.
 */
@Profile("!test")
@RestController
@RequestMapping("/api/v4/sql-search")
@Slf4j
public class SqlSearchControllerV4 {

    private static final int MAX_PAGE_SIZE = 1000;

    private final SqlSearchConfigServiceV4 configService;
    private final SqlQueryServiceV4 queryService;

    public SqlSearchControllerV4(
            SqlSearchConfigServiceV4 configService,
            SqlQueryServiceV4 queryService) {
        this.configService = configService;
        this.queryService = queryService;
    }

    @GetMapping("/config")
    public ResponseEntity<SqlSearchConfigV4> getConfig(
            @RequestHeader(value = AppConstants.CITI_PORTAL_LOGIN_ID_HEADER, required = false) String loginId) {
        log.info("User [{}] requested SQL search config", loginId);
        SqlSearchConfigV4 body = new SqlSearchConfigV4();
        body.setTabs(configService.getTabs());
        return ResponseEntity.ok(body);
    }

    @PostMapping("/ssrm/{tabKey}")
    public ResponseEntity<?> fetchSsrm(
            @PathVariable String tabKey,
            @RequestBody SSRMRequestV4 req,
            @RequestHeader(value = AppConstants.CITI_PORTAL_LOGIN_ID_HEADER, required = false) String loginId) {
        log.info("User [{}] requested SQL tab [{}] ssrm rows {}-{}",
                loginId, tabKey, req.getStartRow(), req.getEndRow());

        // Validate tabKey existence — T-05-16: generic message, no stack trace to client.
        if (configService.getTab(tabKey).isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(createErrorResponse("UNKNOWN_TAB", "Unknown SQL tab: " + tabKey));
        }

        // Validate paging window — T-05-15: cap page size at 1000 (belt-and-suspenders to
        // executor's setMaxRows).
        if (req.getStartRow() < 0
                || req.getEndRow() <= req.getStartRow()
                || (req.getEndRow() - req.getStartRow()) > MAX_PAGE_SIZE) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(createErrorResponse("INVALID_REQUEST",
                            "Invalid paging window: startRow=" + req.getStartRow()
                                    + ", endRow=" + req.getEndRow()
                                    + " (max page size " + MAX_PAGE_SIZE + ")"));
        }

        try {
            SSRMResponseV4 response = queryService.executeTab(tabKey, req);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            // Unknown sort/filter column, unsupported operator, bad sort direction.
            log.warn("Invalid SSRM request for SQL tab [{}]: {}", tabKey, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(createErrorResponse("INVALID_REQUEST", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to execute SQL tab [{}]", tabKey, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("INTERNAL", "SQL tab execution failed"));
        }
    }

    /**
     * Standardized error response per CLAUDE.md Error Response Format.
     * Two-arg variant (with explicit {@code error_type}) — {@link SearchControllerV4} only
     * has a single-arg {@code createErrorResponse(String message)} helper; this surface
     * needs the {@code error_type} discriminator for the Plan 05 acceptance criteria.
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
