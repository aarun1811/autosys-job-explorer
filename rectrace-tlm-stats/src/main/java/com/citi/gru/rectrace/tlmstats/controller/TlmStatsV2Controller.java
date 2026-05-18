package com.citi.gru.rectrace.tlmstats.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.citi.gru.rectrace.tlmstats.model.BreakStats;
import com.citi.gru.rectrace.tlmstats.model.v2.DashboardSummary;
import com.citi.gru.rectrace.tlmstats.model.v2.MergedReconStats;
import com.citi.gru.rectrace.tlmstats.model.v2.TlmStatsRequest;
import com.citi.gru.rectrace.tlmstats.service.TlmStatsV2Service;

/**
 * REST Controller for TLM Statistics V2 APIs with SSRM support
 */
@RestController
@RequestMapping("/api/tlm-stats/v2")
public class TlmStatsV2Controller {

    private static final Logger logger = LoggerFactory.getLogger(TlmStatsV2Controller.class);

    @Autowired
    private TlmStatsV2Service tlmStatsV2Service;

    /**
     * Break Stats API
     * POST /api/tlm-stats/v2/dashboard/breaks
     */
    @PostMapping("/dashboard/breaks")
    public ResponseEntity<?> getBreaksTableData(@RequestBody TlmStatsRequest request) {
        try {
            logger.info("V2 Breaks API called - Request: {}", request);
            
            List<BreakStats> data = tlmStatsV2Service.getBreaksTableData(request);
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("data", data);
            response.put("count", data.size());
            
            logger.info("V2 Breaks API completed successfully - Found {} records", data.size());
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            logger.error("V2 Breaks API validation error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(createErrorResponse("validation_error", e.getMessage()));
        } catch (Exception e) {
            logger.error("V2 Breaks API error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("internal_error", "An internal error occurred"));
        }
    }

    /**
     * Reconciliation Stats API (Merged Automatch + Manual Match)
     * POST /api/tlm-stats/v2/dashboard/recon
     */
    @PostMapping("/dashboard/recon")
    public ResponseEntity<?> getReconTableData(@RequestBody TlmStatsRequest request) {
        try {
            logger.info("V2 Recon API called - Request: {}", request);
            
            List<MergedReconStats> data = tlmStatsV2Service.getReconTableData(request);
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("data", data);
            response.put("count", data.size());
            
            logger.info("V2 Recon API completed successfully - Found {} records", data.size());
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            logger.error("V2 Recon API validation error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(createErrorResponse("validation_error", e.getMessage()));
        } catch (Exception e) {
            logger.error("V2 Recon API error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("internal_error", "An internal error occurred"));
        }
    }

    /**
     * Dashboard Summary API (for pie chart and summary cards)
     * GET /api/tlm-stats/v2/dashboard/summary
     */
    @GetMapping("/dashboard/summary")
    public ResponseEntity<?> getDashboardSummary(
            @RequestParam("tlm_instance") String tlmInstance,
            @RequestParam(value = "agent_code", required = false) List<String> agentCodes,
            @RequestParam(value = "set_id", required = false) List<String> setIds,
            @RequestParam(value = "date_range", defaultValue = "1") int dateRange,
            @RequestParam(value = "entry_point", required = false) String entryPoint) {
        
        try {
            logger.info("V2 Dashboard Summary API called - TLM Instance: {}, Agent Codes: {}, Set IDs: {}, Date Range: {}, Entry Point: {}", 
                       tlmInstance, agentCodes, setIds, dateRange, entryPoint);
            
            DashboardSummary summary = tlmStatsV2Service.getDashboardSummary(tlmInstance, agentCodes, setIds, dateRange, entryPoint);
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("data", summary);
            
            logger.info("V2 Dashboard Summary API completed successfully");
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            logger.error("V2 Dashboard Summary API validation error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(createErrorResponse("validation_error", e.getMessage()));
        } catch (Exception e) {
            logger.error("V2 Dashboard Summary API error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("internal_error", "An internal error occurred"));
        }
    }

    /**
     * Get all recons for a TLM instance
     * GET /api/tlm-stats/v2/filters/recons
     */
    @GetMapping("/filters/recons")
    public ResponseEntity<?> getReconsForTlmInstance(@RequestParam("tlm_instance") String tlmInstance) {
        try {
            logger.info("V2 Get Recons API called - TLM Instance: {}", tlmInstance);
            
            List<String> recons = tlmStatsV2Service.getReconsForTlmInstance(tlmInstance);
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("data", recons);
            response.put("count", recons.size());
            
            logger.info("V2 Get Recons API completed successfully - Found {} recons", recons.size());
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            logger.error("V2 Get Recons API validation error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(createErrorResponse("validation_error", e.getMessage()));
        } catch (Exception e) {
            logger.error("V2 Get Recons API error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("internal_error", "An internal error occurred"));
        }
    }

    /**
     * Get all set_ids for a recon
     * GET /api/tlm-stats/v2/filters/set-ids
     */
    @GetMapping("/filters/set-ids")
    public ResponseEntity<?> getSetIdsForRecon(
            @RequestParam("tlm_instance") String tlmInstance,
            @RequestParam("agent_code") String agentCode) {
        
        try {
            logger.info("V2 Get Set IDs API called - TLM Instance: {}, Agent Code: {}", tlmInstance, agentCode);
            
            List<String> setIds = tlmStatsV2Service.getSetIdsForRecon(tlmInstance, agentCode);
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("data", setIds);
            response.put("count", setIds.size());
            
            logger.info("V2 Get Set IDs API completed successfully - Found {} set IDs", setIds.size());
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            logger.error("V2 Get Set IDs API validation error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(createErrorResponse("validation_error", e.getMessage()));
        } catch (Exception e) {
            logger.error("V2 Get Set IDs API error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("internal_error", "An internal error occurred"));
        }
    }


    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "healthy");
        response.put("service", "TLM Stats V2 API");
        response.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.ok(response);
    }

    /**
     * Creates a standardized error response
     */
    private Map<String, Object> createErrorResponse(String errorType, String message) {
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("status", "error");
        errorResponse.put("error_type", errorType);
        errorResponse.put("message", message);
        errorResponse.put("timestamp", System.currentTimeMillis());
        return errorResponse;
    }
}