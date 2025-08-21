package com.citi.gru.rectrace.tlmstats.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import com.citi.gru.rectrace.tlmstats.config.DatabaseConfig;
import com.citi.gru.rectrace.tlmstats.model.AutomatchStats;
import com.citi.gru.rectrace.tlmstats.model.BreakStats;
import com.citi.gru.rectrace.tlmstats.model.ManualMatchStats;
import com.citi.gru.rectrace.tlmstats.model.v2.DashboardSummary;
import com.citi.gru.rectrace.tlmstats.model.v2.MergedReconStats;
import com.citi.gru.rectrace.tlmstats.model.v2.SsrmRequest;
import com.citi.gru.rectrace.tlmstats.model.v2.SsrmResponse;

/**
 * Service class for executing TLM statistics V2 queries with SSRM support
 */
@Service
public class TlmStatsV2Service {

    private static final Logger logger = LoggerFactory.getLogger(TlmStatsV2Service.class);

    @Autowired
    private DatabaseConfig.TlmJdbcTemplateFactory tlmJdbcTemplateFactory;

    @Autowired
    private JdbcTemplate reconmgmtJdbcTemplate;

    /**
     * Get breaks table data with SSRM support
     */
    public SsrmResponse<BreakStats> getBreaksTableData(SsrmRequest request) {
        validateTlmInstance(request.getTlmInstance());
        
        JdbcTemplate jdbcTemplate = tlmJdbcTemplateFactory.getJdbcTemplate(request.getTlmInstance());
        
        String sql = buildBreaksQuery(request, false);
        Object[] params = buildBreaksParameters(request);
        
        logger.info("Executing V2 Breaks SSRM query for TLM instance: {}", request.getTlmInstance());
        
        List<BreakStats> allData = jdbcTemplate.query(sql, params, getBreakStatsRowMapper());
        
        // Apply sorting
        allData = applySorting(allData, request.getSortModel());
        
        // Calculate pagination
        int totalRows = allData.size();
        List<BreakStats> paginatedData = allData.stream()
            .skip(request.getStartRow())
            .limit(request.getEndRow() - request.getStartRow())
            .collect(Collectors.toList());
        
        return new SsrmResponse<>(paginatedData, totalRows);
    }

    /**
     * Get reconciliation table data with SSRM support (merged automatch + manual match)
     */
    public SsrmResponse<MergedReconStats> getReconTableData(SsrmRequest request) {
        validateTlmInstance(request.getTlmInstance());
        
        // Get merged data
        List<MergedReconStats> mergedData = getMergedReconData(request);
        
        // Apply sorting
        mergedData = applySorting(mergedData, request.getSortModel());
        
        // Calculate pagination
        int totalRows = mergedData.size();
        List<MergedReconStats> paginatedData = mergedData.stream()
            .skip(request.getStartRow())
            .limit(request.getEndRow() - request.getStartRow())
            .collect(Collectors.toList());
        
        return new SsrmResponse<>(paginatedData, totalRows);
    }

    /**
     * Get dashboard summary for pie chart and summary cards
     */
    public DashboardSummary getDashboardSummary(String tlmInstance, List<String> agentCodes, 
                                               List<String> setIds, int dateRange) {
        validateTlmInstance(tlmInstance);
        
        // Calculate totals for breaks
        long totalBreaks = getTotalBreaksCount(tlmInstance, agentCodes, setIds, dateRange);
        
        // Calculate totals for automatch and manual match
        SsrmRequest tempRequest = createTempRequest(tlmInstance, agentCodes, setIds, dateRange);
        List<MergedReconStats> reconData = getMergedReconData(tempRequest);
        
        long totalAutomatchItems = reconData.stream()
            .mapToLong(item -> item.getAutomatchItems() != null ? item.getAutomatchItems() : 0L)
            .sum();
        
        long totalManualMatchItems = reconData.stream()
            .mapToLong(item -> item.getTotalManualMatchCount() != null ? item.getTotalManualMatchCount() : 0L)
            .sum();
        
        return new DashboardSummary(totalBreaks, totalAutomatchItems, totalManualMatchItems);
    }

    /**
     * Get all recons (agent_codes) for a TLM instance
     */
    public List<String> getReconsForTlmInstance(String tlmInstance) {
        validateTlmInstance(tlmInstance);
        
        String sql = "SELECT DISTINCT agent_code AS recon FROM recon_bank WHERE recon_engine_env = ? AND recon_engine = 'TLM' ORDER BY agent_code";
        logger.debug("SQL: {}", sql);
        return reconmgmtJdbcTemplate.queryForList(sql, String.class, tlmInstance);
    }

    /**
     * Get all set_ids for a recon (agent_code)
     */
    public List<String> getSetIdsForRecon(String tlmInstance, String agentCode) {
        validateTlmInstance(tlmInstance);
        
        if (agentCode == null || agentCode.trim().isEmpty()) {
            throw new IllegalArgumentException("Agent code is mandatory");
        }
        
        JdbcTemplate jdbcTemplate = tlmJdbcTemplateFactory.getJdbcTemplate(tlmInstance);
        
        String sql = "SELECT DISTINCT b.local_acc_no FROM bank b WHERE b.agent_code = ? ORDER BY b.local_acc_no";
        
        return jdbcTemplate.queryForList(sql, String.class, agentCode);
    }

    /**
     * Export all breaks data (bypass pagination)
     */
    public List<BreakStats> exportBreaksData(SsrmRequest request) {
        validateTlmInstance(request.getTlmInstance());
        
        JdbcTemplate jdbcTemplate = tlmJdbcTemplateFactory.getJdbcTemplate(request.getTlmInstance());
        
        String sql = buildBreaksQuery(request, false);
        Object[] params = buildBreaksParameters(request);
        
        logger.info("Exporting all V2 Breaks data for TLM instance: {}", request.getTlmInstance());
        
        List<BreakStats> allData = jdbcTemplate.query(sql, params, getBreakStatsRowMapper());
        
        // Apply sorting but no pagination
        return applySorting(allData, request.getSortModel());
    }

    /**
     * Export all reconciliation data (bypass pagination)
     */
    public List<MergedReconStats> exportReconData(SsrmRequest request) {
        validateTlmInstance(request.getTlmInstance());
        
        // Get merged data without pagination
        List<MergedReconStats> mergedData = getMergedReconData(request);
        
        logger.info("Exporting all V2 Recon data for TLM instance: {}", request.getTlmInstance());
        
        // Apply sorting but no pagination
        return applySorting(mergedData, request.getSortModel());
    }

    // Helper method to merge automatch and manual match data
    private List<MergedReconStats> getMergedReconData(SsrmRequest request) {
        JdbcTemplate tlmJdbcTemplate = tlmJdbcTemplateFactory.getJdbcTemplate(request.getTlmInstance());
        
        // Get automatch data
        String automatchSql = buildAutomatchQuery(request);
        Object[] automatchParams = buildAutomatchParameters(request);
        List<AutomatchStats> automatchData = tlmJdbcTemplate.query(automatchSql, automatchParams, getAutomatchStatsRowMapper());
        
        // Get manual match data
        String manualSql = buildManualMatchQuery(request);
        Object[] manualParams = buildManualMatchParameters(request);
        List<ManualMatchStats> manualData = reconmgmtJdbcTemplate.query(manualSql, manualParams, getManualMatchStatsRowMapper());
        
        // Merge data
        return mergeAutomatchAndManualData(automatchData, manualData);
    }

    // Merge automatch and manual match data by common keys
    private List<MergedReconStats> mergeAutomatchAndManualData(List<AutomatchStats> automatchData, 
                                                              List<ManualMatchStats> manualData) {
        Map<String, MergedReconStats> mergedMap = new HashMap<>();
        
        // Process automatch data
        for (AutomatchStats item : automatchData) {
            String key = getMergeKey(item.getTlmInstance(), item.getAgentCode(), item.getSetid(),
                                   item.getStmtDate(), item.getBranCode(), item.getCorrAccNo());
            
            MergedReconStats merged = new MergedReconStats();
            merged.setTlmInstance(item.getTlmInstance());
            merged.setAgentCode(item.getAgentCode());
            merged.setSetid(item.getSetid());
            merged.setStmtDate(item.getStmtDate());
            merged.setBranCode(item.getBranCode());
            merged.setCorrAccNo(item.getCorrAccNo());
            merged.setTotalItems(item.getTotalItems());
            merged.setAutomatchItems(item.getAutomatchItems());
            merged.setTotalManualMatchCount(0L); // Default to 0
            
            mergedMap.put(key, merged);
        }
        
        // Merge manual match data
        for (ManualMatchStats item : manualData) {
            String key = getMergeKey(item.getTlmInstance(), item.getAgentCode(), item.getSetid(),
                                   item.getStmtDate(), item.getBranCode(), item.getCorrAccNo());
            
            MergedReconStats existing = mergedMap.get(key);
            if (existing != null) {
                existing.setTotalManualMatchCount(item.getTotalManualMatchCount());
            } else {
                // Create new entry if only manual match data exists
                MergedReconStats merged = new MergedReconStats();
                merged.setTlmInstance(item.getTlmInstance());
                merged.setAgentCode(item.getAgentCode());
                merged.setSetid(item.getSetid());
                merged.setStmtDate(item.getStmtDate());
                merged.setBranCode(item.getBranCode());
                merged.setCorrAccNo(item.getCorrAccNo());
                merged.setTotalItems(0L); // Default to 0
                merged.setAutomatchItems(0L); // Default to 0
                merged.setTotalManualMatchCount(item.getTotalManualMatchCount());
                
                mergedMap.put(key, merged);
            }
        }
        
        return new ArrayList<>(mergedMap.values());
    }

    // Generate merge key for combining data
    private String getMergeKey(String tlmInstance, String agentCode, String setid, 
                              String stmtDate, String branCode, String corrAccNo) {
        return String.format("%s_%s_%s_%s_%s_%s", 
                            tlmInstance != null ? tlmInstance : "", 
                            agentCode != null ? agentCode : "", 
                            setid != null ? setid : "", 
                            stmtDate != null ? stmtDate : "", 
                            branCode != null ? branCode : "", 
                            corrAccNo != null ? corrAccNo : "");
    }

    // Build breaks query with filters
    private String buildBreaksQuery(SsrmRequest request, boolean countOnly) {
        StringBuilder sql = new StringBuilder();
        sql.append("WITH static AS (");
        sql.append("  SELECT");
        sql.append("    f.mlnv,");
        sql.append("    f.sub_acc_no,");
        sql.append("    f.short_code,");
        sql.append("    f.latest_stmt_date,");
        sql.append("    f.latest_stmt_no,");
        sql.append("    k.agent_code,");
        sql.append("    k.local_acc_no,");
        sql.append("    k.corr_acc_no");
        sql.append("  FROM");
        sql.append("    bank k,");
        sql.append("    message_feed f");
        sql.append("  WHERE");
        sql.append("    f.corr_acc_no = k.corr_acc_no");
        
        // Add filters
        if (request.getAgentCodes() != null && !request.getAgentCodes().isEmpty()) {
            sql.append(" AND k.agent_code IN (");
            sql.append(request.getAgentCodes().stream().map(s -> "?").collect(Collectors.joining(",")));
            sql.append(")");
        }
        if (request.getSetIds() != null && !request.getSetIds().isEmpty()) {
            sql.append(" AND k.local_acc_no IN (");
            sql.append(request.getSetIds().stream().map(s -> "?").collect(Collectors.joining(",")));
            sql.append(")");
        }
        
        sql.append(")");
        
        if (countOnly) {
            sql.append(" SELECT COUNT(*) FROM (");
        }
        
        sql.append(" SELECT");
        sql.append("   COUNT(*) AS breaks_count,");
        sql.append("   s.agent_code,");
        sql.append("   s.local_acc_no,");
        sql.append("   i.stmt_date,");
        sql.append("   i.bran_code");
        sql.append(" FROM");
        sql.append("   item i,");
        sql.append("   static s");
        sql.append(" WHERE");
        sql.append("   s.corr_acc_no = i.corr_acc_no");
        sql.append("   AND i.flag_2 = 0");
        sql.append("   AND ").append(getDateRangeClause(request.getDateRange(), "i.stmt_date"));
        sql.append(" GROUP BY");
        sql.append("   s.agent_code,");
        sql.append("   s.local_acc_no,");
        sql.append("   i.stmt_date,");
        sql.append("   i.bran_code");
        
        if (countOnly) {
            sql.append(")");
        }
        
        return sql.toString();
    }

    // Build automatch query with filters
    private String buildAutomatchQuery(SsrmRequest request) {
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT");
        sql.append("  sys_context('USERENV', 'DB_NAME') tlm_instance,");
        sql.append("  b.agent_code,");
        sql.append("  b.local_acc_no setid,");
        sql.append("  i.stmt_date,");
        sql.append("  i.bran_code,");
        sql.append("  b.corr_acc_no,");
        sql.append("  SUM(CASE WHEN i.flag_2 IN(0, 1, 11) THEN 1 ELSE 0 END) total_items,");
        sql.append("  SUM(CASE WHEN th.last_action_owner IN('SYSTEM', 'system', 'AUTONET') AND i.flag_2 = 1 THEN 1 ELSE 0 END) automatch_items");
        sql.append(" FROM");
        sql.append("  bank b,");
        sql.append("  message_feed mf,");
        sql.append("  item i,");
        sql.append("  tlm_bdr_relationship_header th");
        sql.append(" WHERE");
        sql.append("  b.corr_acc_no = mf.corr_acc_no");
        sql.append("  AND mf.corr_acc_no = i.corr_acc_no");
        sql.append("  AND mf.short_code = i.short_no");
        sql.append("  AND i.relationship_id = th.relationship_id (+)");
        sql.append("  AND mf.mlnv NOT IN ( '9060', '9066' )");
        sql.append("  AND ").append(getDateRangeClause(request.getDateRange(), "i.stmt_date"));
        
        // Add filters
        if (request.getAgentCodes() != null && !request.getAgentCodes().isEmpty()) {
            sql.append(" AND b.agent_code IN (");
            sql.append(request.getAgentCodes().stream().map(s -> "?").collect(Collectors.joining(",")));
            sql.append(")");
        }
        if (request.getSetIds() != null && !request.getSetIds().isEmpty()) {
            sql.append(" AND b.local_acc_no IN (");
            sql.append(request.getSetIds().stream().map(s -> "?").collect(Collectors.joining(",")));
            sql.append(")");
        }
        
        sql.append(" GROUP BY b.agent_code, b.local_acc_no, i.stmt_date, i.bran_code, b.corr_acc_no");
        sql.append(" ORDER BY b.agent_code, b.local_acc_no, i.stmt_date, i.bran_code, b.corr_acc_no");
        
        return sql.toString();
    }

    // Build manual match query with filters
    private String buildManualMatchQuery(SsrmRequest request) {
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT");
        sql.append("  tlm_instance,");
        sql.append("  agent_code,");
        sql.append("  setid,");
        sql.append("  stmt_date,");
        sql.append("  bran_code,");
        sql.append("  corr_acc_no,");
        sql.append("  SUM(manual_match_count) AS total_manual_match_count");
        sql.append(" FROM (");
        
        // First part of UNION
        sql.append("  SELECT");
        sql.append("    COUNT(*) AS manual_match_count,");
        sql.append("    agent_code,");
        sql.append("    setid,");
        sql.append("    corr_acc_no,");
        sql.append("    bran_code,");
        sql.append("    tlm_instance,");
        sql.append("    stmt_date");
        sql.append("  FROM reconmgmt.mr_csum_man_match_details");
        sql.append("  WHERE ").append(getDateRangeClause(request.getDateRange(), "stmt_date"));
        
        // Add filters for first part
        if (request.getTlmInstance() != null) {
            sql.append(" AND tlm_instance = ?");
        }
        if (request.getAgentCodes() != null && !request.getAgentCodes().isEmpty()) {
            sql.append(" AND agent_code IN (");
            sql.append(request.getAgentCodes().stream().map(s -> "?").collect(Collectors.joining(",")));
            sql.append(")");
        }
        if (request.getSetIds() != null && !request.getSetIds().isEmpty()) {
            sql.append(" AND setid IN (");
            sql.append(request.getSetIds().stream().map(s -> "?").collect(Collectors.joining(",")));
            sql.append(")");
        }
        
        sql.append("  GROUP BY agent_code, setid, corr_acc_no, bran_code, tlm_instance, stmt_date");
        
        sql.append("  UNION ALL");
        
        // Second part of UNION
        sql.append("  SELECT");
        sql.append("    COUNT(*) AS manual_match_count,");
        sql.append("    agent_code,");
        sql.append("    local_acc_no AS setid,");
        sql.append("    corr_acc_no,");
        sql.append("    bran_code,");
        sql.append("    tlm_instance,");
        sql.append("    stmt_date");
        sql.append("  FROM reconmgmt.mr_csum_netting_hist");
        sql.append("  WHERE ").append(getDateRangeClause(request.getDateRange(), "stmt_date"));
        
        // Add filters for second part
        if (request.getTlmInstance() != null) {
            sql.append(" AND tlm_instance = ?");
        }
        if (request.getAgentCodes() != null && !request.getAgentCodes().isEmpty()) {
            sql.append(" AND agent_code IN (");
            sql.append(request.getAgentCodes().stream().map(s -> "?").collect(Collectors.joining(",")));
            sql.append(")");
        }
        if (request.getSetIds() != null && !request.getSetIds().isEmpty()) {
            sql.append(" AND local_acc_no IN (");
            sql.append(request.getSetIds().stream().map(s -> "?").collect(Collectors.joining(",")));
            sql.append(")");
        }
        
        sql.append("  GROUP BY agent_code, local_acc_no, corr_acc_no, bran_code, tlm_instance, stmt_date");
        sql.append(" ) combined_results");
        sql.append(" GROUP BY agent_code, setid, corr_acc_no, bran_code, tlm_instance, stmt_date");
        
        return sql.toString();
    }

    // Get date range clause based on days
    private String getDateRangeClause(int days, String dateColumn) {
        if (days == 1) {
            // Business day logic for 1 day
            return dateColumn + " BETWEEN TRUNC(SYSDATE) - (DECODE(TO_CHAR(SYSDATE, 'D'), 1, 1, 2, 3, 3, 1, 4, 1, 5, 1, 6, 1, 7, 1)) AND SYSDATE - 1";
        } else {
            // Calendar days for 7 and 30 days
            return dateColumn + " BETWEEN SYSDATE - " + days + " AND SYSDATE - 1";
        }
    }

    // Build parameters for breaks query
    private Object[] buildBreaksParameters(SsrmRequest request) {
        List<Object> params = new ArrayList<>();
        
        if (request.getAgentCodes() != null && !request.getAgentCodes().isEmpty()) {
            params.addAll(request.getAgentCodes());
        }
        if (request.getSetIds() != null && !request.getSetIds().isEmpty()) {
            params.addAll(request.getSetIds());
        }
        
        return params.toArray();
    }

    // Build parameters for automatch query
    private Object[] buildAutomatchParameters(SsrmRequest request) {
        List<Object> params = new ArrayList<>();
        
        if (request.getAgentCodes() != null && !request.getAgentCodes().isEmpty()) {
            params.addAll(request.getAgentCodes());
        }
        if (request.getSetIds() != null && !request.getSetIds().isEmpty()) {
            params.addAll(request.getSetIds());
        }
        
        return params.toArray();
    }

    // Build parameters for manual match query
    private Object[] buildManualMatchParameters(SsrmRequest request) {
        List<Object> params = new ArrayList<>();
        
        // First part of UNION
        if (request.getTlmInstance() != null) {
            params.add(request.getTlmInstance());
        }
        if (request.getAgentCodes() != null && !request.getAgentCodes().isEmpty()) {
            params.addAll(request.getAgentCodes());
        }
        if (request.getSetIds() != null && !request.getSetIds().isEmpty()) {
            params.addAll(request.getSetIds());
        }
        
        // Second part of UNION (same parameters repeated)
        if (request.getTlmInstance() != null) {
            params.add(request.getTlmInstance());
        }
        if (request.getAgentCodes() != null && !request.getAgentCodes().isEmpty()) {
            params.addAll(request.getAgentCodes());
        }
        if (request.getSetIds() != null && !request.getSetIds().isEmpty()) {
            params.addAll(request.getSetIds());
        }
        
        return params.toArray();
    }

    // Generic sorting method
    @SuppressWarnings("unchecked")
    private <T> List<T> applySorting(List<T> data, List<Map<String, Object>> sortModel) {
        if (sortModel == null || sortModel.isEmpty()) {
            return data;
        }
        
        return data.stream().sorted((o1, o2) -> {
            for (Map<String, Object> sort : sortModel) {
                String colId = (String) sort.get("colId");
                String sortDirection = (String) sort.get("sort");
                
                Comparable<Object> value1 = getFieldValue(o1, colId);
                Comparable<Object> value2 = getFieldValue(o2, colId);
                
                int result = 0;
                if (value1 != null && value2 != null) {
                    result = value1.compareTo(value2);
                } else if (value1 != null) {
                    result = 1;
                } else if (value2 != null) {
                    result = -1;
                }
                
                if ("desc".equals(sortDirection)) {
                    result = -result;
                }
                
                if (result != 0) {
                    return result;
                }
            }
            return 0;
        }).collect(Collectors.toList());
    }

    // Get field value using reflection for sorting
    @SuppressWarnings("unchecked")
    private Comparable<Object> getFieldValue(Object obj, String fieldName) {
        try {
            String methodName = "get" + fieldName.substring(0, 1).toUpperCase() + fieldName.substring(1);
            if (fieldName.equals("stmt_date")) {
                methodName = "getStmtDate";
            } else if (fieldName.equals("agent_code")) {
                methodName = "getAgentCode";
            } else if (fieldName.equals("local_acc_no")) {
                methodName = "getLocalAccNo";
            } else if (fieldName.equals("breaks_count")) {
                methodName = "getBreaksCount";
            } else if (fieldName.equals("bran_code")) {
                methodName = "getBranCode";
            } else if (fieldName.equals("tlm_instance")) {
                methodName = "getTlmInstance";
            } else if (fieldName.equals("setid")) {
                methodName = "getSetid";
            } else if (fieldName.equals("corr_acc_no")) {
                methodName = "getCorrAccNo";
            } else if (fieldName.equals("total_items")) {
                methodName = "getTotalItems";
            } else if (fieldName.equals("automatch_items")) {
                methodName = "getAutomatchItems";
            } else if (fieldName.equals("total_manual_match_count")) {
                methodName = "getTotalManualMatchCount";
            }
            
            return (Comparable<Object>) obj.getClass().getMethod(methodName).invoke(obj);
        } catch (Exception e) {
            logger.warn("Could not get field value for sorting: {}", fieldName, e);
            return null;
        }
    }

    // Get total breaks count for summary
    private long getTotalBreaksCount(String tlmInstance, List<String> agentCodes, List<String> setIds, int dateRange) {
        JdbcTemplate jdbcTemplate = tlmJdbcTemplateFactory.getJdbcTemplate(tlmInstance);
        
        SsrmRequest tempRequest = createTempRequest(tlmInstance, agentCodes, setIds, dateRange);
        String sql = buildBreaksQuery(tempRequest, true);
        Object[] params = buildBreaksParameters(tempRequest);
        
        Long count = jdbcTemplate.queryForObject(sql, params, Long.class);
        return count != null ? count : 0L;
    }

    // Create temporary request for summary calculations
    private SsrmRequest createTempRequest(String tlmInstance, List<String> agentCodes, List<String> setIds, int dateRange) {
        SsrmRequest request = new SsrmRequest();
        request.setTlmInstance(tlmInstance);
        request.setAgentCodes(agentCodes);
        request.setSetIds(setIds);
        request.setDateRange(dateRange);
        return request;
    }

    // Validation methods
    private void validateTlmInstance(String tlmInstance) {
        if (tlmInstance == null || tlmInstance.trim().isEmpty()) {
            throw new IllegalArgumentException("TLM instance is mandatory");
        }
        if (!tlmJdbcTemplateFactory.hasTlmInstance(tlmInstance)) {
            throw new IllegalArgumentException("TLM instance not found: " + tlmInstance);
        }
    }

    // Row mappers
    private RowMapper<BreakStats> getBreakStatsRowMapper() {
        return (rs, rowNum) -> new BreakStats(
            rs.getLong("breaks_count"),
            rs.getString("agent_code"),
            rs.getString("local_acc_no"),
            rs.getString("stmt_date"),
            rs.getString("bran_code")
        );
    }

    private RowMapper<AutomatchStats> getAutomatchStatsRowMapper() {
        return (rs, rowNum) -> new AutomatchStats(
            rs.getString("tlm_instance"),
            rs.getString("agent_code"),
            rs.getString("setid"),
            rs.getString("stmt_date"),
            rs.getString("bran_code"),
            rs.getString("corr_acc_no"),
            rs.getLong("total_items"),
            rs.getLong("automatch_items")
        );
    }

    private RowMapper<ManualMatchStats> getManualMatchStatsRowMapper() {
        return (rs, rowNum) -> new ManualMatchStats(
            rs.getString("tlm_instance"),
            rs.getString("agent_code"),
            rs.getString("setid"),
            rs.getString("stmt_date"),
            rs.getString("bran_code"),
            rs.getString("corr_acc_no"),
            rs.getLong("total_manual_match_count")
        );
    }
}