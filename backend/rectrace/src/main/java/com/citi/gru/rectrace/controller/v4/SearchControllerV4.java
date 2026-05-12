package com.citi.gru.rectrace.controller.v4;

import com.citi.gru.rectrace.dto.v4.*;
import com.citi.gru.rectrace.service.v4.SearchServiceV4;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletResponse;
import java.util.HashMap;
import java.util.Map;

@Profile("!test")
@RestController
@RequestMapping("/api/v4/search")
@CrossOrigin(origins = "*")
@Slf4j
public class SearchControllerV4 {
    
    @Autowired
    private SearchServiceV4 searchService;
    
    @GetMapping("/initial")
    public ResponseEntity<?> performInitialSearch(
            @RequestParam String keyword,
            @RequestHeader(value = "x-citiportal-loginid", required = false) String userId) {
        
        try {
            log.info("Initial search request - keyword: {}, user: {}", keyword, userId);
            
            if (keyword == null || keyword.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(createErrorResponse("Search keyword is required"));
            }
            
            InitialSearchResponseV4 response = searchService.performInitialSearch(keyword);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error performing initial search", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("Search failed: " + e.getMessage()));
        }
    }
    
    @PostMapping("/ssrm/{category}")
    public ResponseEntity<?> fetchSSRMData(
            @PathVariable String category,
            @RequestBody SSRMRequestV4 request,
            @RequestHeader(value = "x-citiportal-loginid", required = false) String userId) {
        
        try {
            log.debug("SSRM request - category: {}, user: {}, startRow: {}, endRow: {}", 
                    category, userId, request.getStartRow(), request.getEndRow());
            
            // Set category in request if not present
            if (request.getCategory() == null) {
                request.setCategory(category);
            }
            
            SSRMResponseV4 response = searchService.fetchSSRMData(category, request);
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            log.error("Invalid request for SSRM data", e);
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("Error fetching SSRM data", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("Failed to fetch data: " + e.getMessage()));
        }
    }
    
    @GetMapping("/config")
    public ResponseEntity<?> getSearchConfiguration() {
        try {
            SearchConfigurationV4 config = searchService.getConfiguration();
            return ResponseEntity.ok(config);
        } catch (Exception e) {
            log.error("Error fetching configuration", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(createErrorResponse("Failed to fetch configuration"));
        }
    }
    
    @PostMapping("/export/{category}")
    public void exportData(
            @PathVariable String category,
            @RequestBody ExportRequestV4 request,
            @RequestHeader(value = "x-citiportal-loginid", required = false) String userId,
            HttpServletResponse response) {
        
        try {
            log.info("Export request - category: {}, user: {}", category, userId);
            
            // Set category in request if not present
            if (request.getCategory() == null) {
                request.setCategory(category);
            }
            
            // Generate Excel file
            byte[] excelBytes = searchService.exportToExcel(category, request);
            
            // Set response headers for Excel download
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setHeader("Content-Disposition", "attachment; filename=" + category + "_export_" + System.currentTimeMillis() + ".xlsx");
            response.setContentLength(excelBytes.length);
            
            // Write Excel bytes to response
            response.getOutputStream().write(excelBytes);
            response.getOutputStream().flush();
            
            log.info("Export completed successfully for category: {}", category);
            
        } catch (Exception e) {
            log.error("Error exporting data", e);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            try {
                response.getWriter().write("Export failed: " + e.getMessage());
            } catch (Exception ex) {
                // Ignore write error
            }
        }
    }
    
    @GetMapping("/health")
    public ResponseEntity<?> health() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("service", "SearchV4");
        health.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.ok(health);
    }
    
    private Map<String, Object> createErrorResponse(String message) {
        Map<String, Object> error = new HashMap<>();
        error.put("status", "error");
        error.put("message", message);
        error.put("timestamp", System.currentTimeMillis());
        return error;
    }
}