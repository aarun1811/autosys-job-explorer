package com.citi.gru.rectrace.quickrec.controller;

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

import com.citi.gru.rectrace.quickrec.model.QuickRecAutoMatchStats;
import com.citi.gru.rectrace.quickrec.model.QuickRecDashboardSummary;
import com.citi.gru.rectrace.quickrec.model.QuickRecManualMatchStats;
import com.citi.gru.rectrace.quickrec.model.QuickRecStatsRequest;
import com.citi.gru.rectrace.quickrec.service.QuickRecStatsService;

/**
 * REST Controller for QuickRec Statistics APIs
 */
@RestController
@RequestMapping("/api/quickrec-stats")
public class QuickRecStatsController {
    
    private static final Logger logger = LoggerFactory.getLogger(QuickRecStatsController.class);
    
    @Autowired
    private QuickRecStatsService quickRecStatsService;
    
    /**
     * Get auto-match statistics
     * POST /api/quickrec-stats/automatch
     */
    @PostMapping("/automatch")
    public ResponseEntity<?> getAutoMatchStats(@RequestBody QuickRecStatsRequest request) {
        try {
            logger.info("QuickRec Auto-Match API called - Request: {}", request);
            
            List<QuickRecAutoMatchStats> data = quickRecStatsService.getAutoMatchStats(request);
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("data", data);
            response.put("count", data.size());
            
            logger.info("QuickRec Auto-Match API completed successfully - Found {} records", data.size());
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            logger.error("QuickRec Auto-Match API validation error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(createErrorResponse("validation_error", e.getMessage()));
        } catch (Exception e) {
            logger.error("QuickRec Auto-Match API error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("internal_error", "An internal error occurred"));
        }
    }
    
    /**
     * Get manual match statistics
     * POST /api/quickrec-stats/manual-match
     */
    @PostMapping("/manual-match")
    public ResponseEntity<?> getManualMatchStats(@RequestBody QuickRecStatsRequest request) {
        try {
            logger.info("QuickRec Manual Match API called - Request: {}", request);
            
            List<QuickRecManualMatchStats> data = quickRecStatsService.getManualMatchStats(request);
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("data", data);
            response.put("count", data.size());
            
            logger.info("QuickRec Manual Match API completed successfully - Found {} records", data.size());
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            logger.error("QuickRec Manual Match API validation error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(createErrorResponse("validation_error", e.getMessage()));
        } catch (Exception e) {
            logger.error("QuickRec Manual Match API error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("internal_error", "An internal error occurred"));
        }
    }
    
    /**
     * Get dashboard summary
     * GET /api/quickrec-stats/summary
     */
    @GetMapping("/summary")
    public ResponseEntity<?> getDashboardSummary(
            @RequestParam(value = "recon_id", required = false) String reconId,
            @RequestParam(value = "rec_portal_id", required = false) String recPortalId,
            @RequestParam(value = "date_range", defaultValue = "1") int dateRange,
            @RequestParam(value = "entry_point", required = false) String entryPoint) {
        
        try {
            logger.info("QuickRec Dashboard Summary API called - ReconId: {}, RecPortalId: {}, DateRange: {}, EntryPoint: {}",
                       reconId, recPortalId, dateRange, entryPoint);
            
            // Create request object
            QuickRecStatsRequest request = new QuickRecStatsRequest();
            request.setReconId(reconId);
            request.setRecPortalId(recPortalId);
            request.setDateRange(dateRange);
            request.setEntryPoint(entryPoint);
            
            QuickRecDashboardSummary summary = quickRecStatsService.getDashboardSummary(request);
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("data", summary);
            
            logger.info("QuickRec Dashboard Summary API completed successfully");
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            logger.error("QuickRec Dashboard Summary API validation error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(createErrorResponse("validation_error", e.getMessage()));
        } catch (Exception e) {
            logger.error("QuickRec Dashboard Summary API error: {}", e.getMessage(), e);
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
        response.put("service", "QuickRec Stats API");
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