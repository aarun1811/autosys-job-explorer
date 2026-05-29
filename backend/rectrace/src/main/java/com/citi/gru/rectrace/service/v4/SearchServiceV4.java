package com.citi.gru.rectrace.service.v4;

import com.citi.gru.rectrace.dto.v4.*;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Profile("!test")
@Service
@Slf4j
public class SearchServiceV4 {
    
    @Autowired
    private ElasticsearchServiceV4 esService;
    
    @Autowired
    private OracleServiceV4 oracleService;
    
    @Autowired
    private SearchConfigServiceV4 configService;
    
    public InitialSearchResponseV4 performInitialSearch(String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            log.warn("Empty search keyword provided");
            return InitialSearchResponseV4.builder()
                    .categoryResults(new HashMap<>())
                    .searchTerm(keyword)
                    .timestamp(System.currentTimeMillis())
                    .build();
        }
        
        log.info("Performing initial search for keyword: {}", keyword);
        
        Map<String, CategoryResultV4> categoryResults = new ConcurrentHashMap<>();
        List<CompletableFuture<Void>> futures = new ArrayList<>();
        
        // Search all categories in parallel
        for (CategoryConfigV4 category : configService.getCategories()) {
            CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                try {
                    // Dashboard-only category: no ES index configured. Emit the
                    // category (so the dashboard tab renders) without running a
                    // search. Coalesce columns null -> empty list so /initial
                    // never emits columns: null (React Zod requires an array).
                    if (category.getElasticsearch() == null) {
                        categoryResults.put(category.getKey(), CategoryResultV4.builder()
                                .key(category.getKey())
                                .label(category.getLabel())
                                .values(new ArrayList<>())
                                .count(0)
                                .hasMore(false)
                                .columns(category.getColumns() != null ? category.getColumns() : new ArrayList<>())
                                .dashboard(category.getDashboard())
                                .build());
                        return; // skip ES for a dashboard-only category
                    }

                    // Get unique values from Elasticsearch
                    List<String> uniqueValues = esService.getUniqueValues(keyword, category);

                    // Build category result
                    CategoryResultV4 result = CategoryResultV4.builder()
                            .key(category.getKey())
                            .label(category.getLabel())
                            .values(uniqueValues)
                            .count(uniqueValues.size())
                            .hasMore(uniqueValues.size() >= 1000)  // Hit the limit
                            .columns(category.getColumns())
                            .dashboard(category.getDashboard())
                            .build();

                    categoryResults.put(category.getKey(), result);

                    log.debug("Category {} returned {} results", category.getKey(), uniqueValues.size());

                } catch (Exception e) {
                    log.error("Error searching category: " + category.getKey(), e);
                    // Add empty result for failed category
                    CategoryResultV4 emptyResult = CategoryResultV4.builder()
                            .key(category.getKey())
                            .label(category.getLabel())
                            .values(new ArrayList<>())
                            .count(0)
                            .hasMore(false)
                            .columns(category.getColumns())
                            .dashboard(category.getDashboard())
                            .build();
                    categoryResults.put(category.getKey(), emptyResult);
                }
            });
            futures.add(future);
        }
        
        // Wait for all searches to complete
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        
        log.info("Initial search completed. Categories with results: {}", 
                categoryResults.values().stream()
                        .filter(c -> c.getCount() > 0)
                        .map(CategoryResultV4::getKey)
                        .collect(Collectors.toList()));
        
        return InitialSearchResponseV4.builder()
                .categoryResults(categoryResults)
                .searchTerm(keyword)
                .timestamp(System.currentTimeMillis())
                .build();
    }
    
    public SSRMResponseV4 fetchSSRMData(String categoryKey, SSRMRequestV4 request) {
        // Validate category
        if (!configService.isValidCategory(categoryKey)) {
            log.error("Invalid category: {}", categoryKey);
            return SSRMResponseV4.builder()
                    .rows(new ArrayList<>())
                    .lastRow(0)
                    .build();
        }
        
        CategoryConfigV4 config = configService.getCategoryConfig(categoryKey);
        
        log.debug("Fetching SSRM data for category: {}, startRow: {}, endRow: {}", 
                categoryKey, request.getStartRow(), request.getEndRow());
        
        // Delegate to Oracle service
        return oracleService.fetchSSRMData(config, request);
    }
    
    public SearchConfigurationV4 getConfiguration() {
        return configService.getConfiguration();
    }
    
    public byte[] exportToExcel(String categoryKey, ExportRequestV4 request) throws IOException {
        log.info("Starting Excel export for category: {}", categoryKey);
        
        CategoryConfigV4 config = configService.getCategoryConfig(categoryKey);
        
        // Fetch all data for export (without pagination)
        SSRMRequestV4 ssrmRequest = SSRMRequestV4.builder()
                .category(categoryKey)
                .initialFilter(request.getInitialFilter())
                .startRow(0)
                .endRow(10000)  // Fetch max 10000 rows for export
                .rowGroupCols(new ArrayList<>())
                .groupKeys(new ArrayList<>())
                .sortModel(request.getSortModel() != null ? request.getSortModel() : new ArrayList<>())
                .filterModel(request.getFilterModel() != null ? request.getFilterModel() : new HashMap<>())
                .build();
        
        SSRMResponseV4 data = oracleService.fetchSSRMData(config, ssrmRequest);
        
        // Create Excel workbook
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            
            Sheet sheet = workbook.createSheet(config.getLabel());
            
            // Create header row style
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            
            // Create header row
            Row headerRow = sheet.createRow(0);
            List<String> columns = request.getColumns() != null ? request.getColumns() : 
                    config.getColumns().stream()
                            .filter(col -> !Boolean.TRUE.equals(col.getHide()))
                            .map(ColumnDefinition::getField)
                            .collect(Collectors.toList());
            
            // Find column definitions for headers
            Map<String, String> fieldToHeader = new HashMap<>();
            for (ColumnDefinition colDef : config.getColumns()) {
                fieldToHeader.put(colDef.getField(), colDef.getHeaderName());
            }
            
            // Create headers
            for (int i = 0; i < columns.size(); i++) {
                Cell cell = headerRow.createCell(i);
                String headerName = fieldToHeader.getOrDefault(columns.get(i), columns.get(i));
                cell.setCellValue(headerName);
                cell.setCellStyle(headerStyle);
            }
            
            // Add data rows
            int rowNum = 1;
            for (Map<String, Object> rowData : data.getRows()) {
                Row row = sheet.createRow(rowNum++);
                for (int i = 0; i < columns.size(); i++) {
                    Cell cell = row.createCell(i);
                    Object value = rowData.get(columns.get(i));
                    if (value != null) {
                        if (value instanceof Number) {
                            cell.setCellValue(((Number) value).doubleValue());
                        } else {
                            cell.setCellValue(value.toString());
                        }
                    }
                }
            }
            
            // Auto-size columns
            for (int i = 0; i < columns.size(); i++) {
                sheet.autoSizeColumn(i);
                // Set max width to prevent extremely wide columns
                int columnWidth = sheet.getColumnWidth(i);
                if (columnWidth > 15000) {
                    sheet.setColumnWidth(i, 15000);
                }
            }
            
            workbook.write(outputStream);
            log.info("Excel export completed. Rows exported: {}", data.getRows().size());
            return outputStream.toByteArray();
        }
    }
}