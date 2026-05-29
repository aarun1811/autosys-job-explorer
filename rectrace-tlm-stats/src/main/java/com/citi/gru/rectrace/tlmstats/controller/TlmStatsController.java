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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.citi.gru.rectrace.tlmstats.model.AutomatchStats;
import com.citi.gru.rectrace.tlmstats.model.BreakStats;
import com.citi.gru.rectrace.tlmstats.model.ManualMatchStats;
import com.citi.gru.rectrace.tlmstats.service.TlmStatsService;

/**
 * REST Controller for TLM Statistics APIs
 */
@RestController
@RequestMapping("/api/tlm-stats")
public class TlmStatsController {

    private static final Logger logger = LoggerFactory.getLogger(TlmStatsController.class);

    @Autowired
    private TlmStatsService tlmStatsService;

    /**
     * Break Stats API
     * GET /api/tlm-stats/breaks
     * 
     * @param tlmInstance - Mandatory TLM instance identifier
     * @param localAccNo - Optional local account number
     * @param agentCode - Optional agent code
     * @return JSON response with break statistics
     */
    @GetMapping("/breaks")
    public ResponseEntity<?> getBreakStats(
            @RequestParam("tlm_instance") String tlmInstance,
            @RequestParam(value = "local_acc_no", required = false) String localAccNo,
            @RequestParam(value = "agent_code", required = false) String agentCode) {
        
        try {
            logger.info("Break Stats API called - TLM Instance: {}, Local Acc No: {}, Agent Code: {}", 
                       tlmInstance, localAccNo, agentCode);
            
            List<BreakStats> results = tlmStatsService.getBreakStats(tlmInstance, localAccNo, agentCode);
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("tlm_instance", tlmInstance);
            response.put("data", results);
            response.put("count", results.size());
            
            logger.info("Break Stats API completed successfully - Found {} records", results.size());
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            logger.error("Break Stats API validation error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(createErrorResponse("validation_error", e.getMessage()));
        } catch (Exception e) {
            logger.error("Break Stats API error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("internal_error", "An internal error occurred"));
        }
    }

    /**
     * Automatch Stats API
     * GET /api/tlm-stats/automatch
     * 
     * @param tlmInstance - Mandatory TLM instance identifier
     * @param localAccNo - Optional local account number
     * @param agentCode - Optional agent code
     * @return JSON response with automatch statistics
     */
    @GetMapping("/automatch")
    public ResponseEntity<?> getAutomatchStats(
            @RequestParam("tlm_instance") String tlmInstance,
            @RequestParam(value = "local_acc_no", required = false) String localAccNo,
            @RequestParam(value = "agent_code", required = false) String agentCode) {
        
        try {
            logger.info("Automatch Stats API called - TLM Instance: {}, Local Acc No: {}, Agent Code: {}", 
                       tlmInstance, localAccNo, agentCode);
            
            List<AutomatchStats> results = tlmStatsService.getAutomatchStats(tlmInstance, localAccNo, agentCode);
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("tlm_instance", tlmInstance);
            response.put("data", results);
            response.put("count", results.size());
            
            logger.info("Automatch Stats API completed successfully - Found {} records", results.size());
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            logger.error("Automatch Stats API validation error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(createErrorResponse("validation_error", e.getMessage()));
        } catch (Exception e) {
            logger.error("Automatch Stats API error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("internal_error", "An internal error occurred"));
        }
    }

    /**
     * Manual Match Stats API
     * GET /api/tlm-stats/manual-match
     * 
     * @param setId - Optional set ID
     * @param agentCode - Optional agent code
     * @param tlmInstance - Optional TLM instance identifier
     * @return JSON response with manual match statistics
     */
    @GetMapping("/manual-match")
    public ResponseEntity<?> getManualMatchStats(
            @RequestParam(value = "set_id", required = false) String setId,
            @RequestParam(value = "agent_code", required = false) String agentCode,
            @RequestParam(value = "tlm_instance", required = false) String tlmInstance) {
        
        try {
            logger.info("Manual Match Stats API called - Set ID: {}, Agent Code: {}, TLM Instance: {}", 
                       setId, agentCode, tlmInstance);
            
            List<ManualMatchStats> results = tlmStatsService.getManualMatchStats(setId, agentCode, tlmInstance);
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("data", results);
            response.put("count", results.size());
            
            logger.info("Manual Match Stats API completed successfully - Found {} records", results.size());
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            logger.error("Manual Match Stats API validation error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(createErrorResponse("validation_error", e.getMessage()));
        } catch (Exception e) {
            logger.error("Manual Match Stats API error: {}", e.getMessage(), e);
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
        response.put("service", "TLM Stats API");
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