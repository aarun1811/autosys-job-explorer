package com.citi.gru.rectrace.tlmstats.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
import com.citi.gru.rectrace.tlmstats.model.v2.TlmStatsRequest;

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

    private static final Map<String, String> TLM_INSTANCE_MAP = Map.ofEntries(
        Map.entry("TLMP_ASIA", "APTLMPP"),
        Map.entry("TLMP_IND", "INTLMP"),
        Map.entry("TLMP_CONSUMER", "TCOSPRD"),
        Map.entry("TLMP_FEM", "TFEMPRD"),
        Map.entry("TLMP_FNM", "TFNMPRD"),
        Map.entry("TLMP_INT", "TINTPRD"),
        Map.entry("TLMP_INV", "TINVPRD"),
        Map.entry("TLMP_LAT", "TLATPRD"),
        Map.entry("TLMP_OPS", "TOPSPRD"),
        Map.entry("TLMP_PFSS", "TSFSPRD"),
        Map.entry("TLMP_PNS", "TPNSPRD"),
        Map.entry("TLMP_SNPB", "TSNBPRD"),
        Map.entry("TCOSPRD", "TLMP_CONSUMER"),
        Map.entry("TFEMPRD", "TLMP_FEM"),
        Map.entry("TFNMPRD", "TLMP_FNM"),
        Map.entry("TINTPRD", "TLMP_INT"),
        Map.entry("TINVPRD", "TLMP_INV"),
        Map.entry("TLATPRD", "TLMP_LAT"),
        Map.entry("TOPSPRD", "TLMP_OPS"),
        Map.entry("TSFSPRD", "TLMP_PFSS"),
        Map.entry("TPNSPRD", "TLMP_PNS"),
        Map.entry("TSNBPRD", "TLMP_SNPB"),
        Map.entry("APTLMPP", "TLMP_ASIA"),
        Map.entry("INTLMP", "TLMP_IND")
    );

    /**
     * Get all breaks table data
     */
    public List<BreakStats> getBreaksTableData(TlmStatsRequest request) {
        validateTlmInstance(request.getTlmInstance());
        
        logger.info("Executing V2 Breaks query for TLM instance: {}, Entry Point: {}", 
                   request.getTlmInstance(), request.getEntryPoint());
        
        // Check if we need to filter in Java based on entry point
        if ("recon".equals(request.getEntryPoint()) || "tlm_instance".equals(request.getEntryPoint())) {
            // Fetch all data without date filter and filter in Java
            List<BreakStats> allBreaks = getBreaksWithoutDateFilter(request);
            return filterBreaksByDate(allBreaks, request.getDateRange());
        } else {
            // Use normal SQL filtering for set_id entry point
            JdbcTemplate jdbcTemplate = tlmJdbcTemplateFactory.getJdbcTemplate(request.getTlmInstance());
            String sql = buildBreaksQuery(request, false);
            Object[] params = buildBreaksParameters(request);
            return jdbcTemplate.query(sql, params, getBreakStatsRowMapper());
        }
    }

    /**
     * Get all reconciliation table data (merged automatch + manual match)
     */
    public List<MergedReconStats> getReconTableData(TlmStatsRequest request) {
        validateTlmInstance(request.getTlmInstance());
        
        // Get merged data
        return getMergedReconData(request);
    }

    /**
     * Get dashboard summary for pie chart and summary cards
     */
    public DashboardSummary getDashboardSummary(String tlmInstance, List<String> agentCodes, 
                                               List<String> setIds, int dateRange, String entryPoint) {
        validateTlmInstance(tlmInstance);
        
        // Calculate totals for breaks
        long totalBreaks = getTotalBreaksCount(tlmInstance, agentCodes, setIds, dateRange, entryPoint);
        
        // Calculate totals for automatch and manual match
        TlmStatsRequest tempRequest = createTempRequest(tlmInstance, agentCodes, setIds, dateRange, entryPoint);
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
        // logger.info("SQL: {}", sql);
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
        
        String sql = "SELECT DISTINCT local_acc_no AS set_id FROM recon_bank WHERE recon_engine_env = ? AND recon_engine = 'TLM' AND agent_code = ? ORDER BY local_acc_no";
        // logger.info("SQL: {}", sql);
        return reconmgmtJdbcTemplate.queryForList(sql, String.class, tlmInstance, agentCode);
    }

    // Helper method to get breaks without date filter
    private List<BreakStats> getBreaksWithoutDateFilter(TlmStatsRequest request) {
        JdbcTemplate jdbcTemplate = tlmJdbcTemplateFactory.getJdbcTemplate(request.getTlmInstance());
        
        // Build query without date filter
        String sql = buildBreaksQueryWithoutDateFilter(request);
        Object[] params = buildBreaksParameters(request);
        
        return jdbcTemplate.query(sql, params, getBreakStatsRowMapper());
    }
    
    // Filter breaks by date in Java
    private List<BreakStats> filterBreaksByDate(List<BreakStats> breaks, int dateRange) {
        if (breaks == null || breaks.isEmpty()) {
            return breaks;
        }
        
        // Calculate the date threshold
        java.sql.Date threshold = getDateThreshold(dateRange);
        
        return breaks.stream()
            .filter(breakStat -> {
                try {
                    if (breakStat.getStmtDate() == null) {
                        return false;
                    }
                    // Parse the date string (assuming format like "2024-01-15" or similar)
                    java.sql.Date stmtDate = java.sql.Date.valueOf(breakStat.getStmtDate());
                    return stmtDate.after(threshold) || stmtDate.equals(threshold);
                } catch (Exception e) {
                    logger.warn("Failed to parse date: {}", breakStat.getStmtDate());
                    return false;
                }
            })
            .collect(Collectors.toList());
    }
    
    // Calculate date threshold based on date range
    private java.sql.Date getDateThreshold(int dateRange) {
        java.util.Calendar cal = java.util.Calendar.getInstance();
        
        if (dateRange == 1) {
            // Business day logic
            int dayOfWeek = cal.get(java.util.Calendar.DAY_OF_WEEK);
            if (dayOfWeek == java.util.Calendar.MONDAY) {
                cal.add(java.util.Calendar.DAY_OF_MONTH, -3); // Friday
            } else if (dayOfWeek == java.util.Calendar.SUNDAY) {
                cal.add(java.util.Calendar.DAY_OF_MONTH, -2); // Friday
            } else {
                cal.add(java.util.Calendar.DAY_OF_MONTH, -1); // Previous day
            }
        } else {
            // Calendar days
            cal.add(java.util.Calendar.DAY_OF_MONTH, -dateRange);
        }
        
        return new java.sql.Date(cal.getTimeInMillis());
    }
    
    // Helper method to merge automatch and manual match data
    private List<MergedReconStats> getMergedReconData(TlmStatsRequest request) {
        // Check if we should use reconmgmt-only query
        boolean useReconmgmtOnly = shouldUseReconmgmtOnlyQuery(request);
        
        if (useReconmgmtOnly) {
            // Use reconmgmt-only query for recon data
            return getReconDataFromReconmgmtOnly(request);
        } else {
            // Original logic for set_id with date range 1
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
    }
    
    // Check if we should use reconmgmt-only query
    private boolean shouldUseReconmgmtOnlyQuery(TlmStatsRequest request) {
        if ("set_id".equals(request.getEntryPoint())) {
            // For set_id: use reconmgmt-only for date range 7 and 30
            return request.getDateRange() != 1;
        } else {
            // For recon and tlm_instance: always use reconmgmt-only
            return "recon".equals(request.getEntryPoint()) || "tlm_instance".equals(request.getEntryPoint());
        }
    }
    
    // Get recon data from reconmgmt database only
    private List<MergedReconStats> getReconDataFromReconmgmtOnly(TlmStatsRequest request) {
        String sql = buildReconmgmtOnlyQuery(request);
        Object[] params = buildReconmgmtOnlyParameters(request);
        
        logger.info("Using reconmgmt-only query for entry point: {}, date range: {}", 
                   request.getEntryPoint(), request.getDateRange());
        
        return reconmgmtJdbcTemplate.query(sql, params, (rs, rowNum) -> {
            MergedReconStats stats = new MergedReconStats();
            stats.setTlmInstance(TLM_INSTANCE_MAP.get(rs.getString("tlm_instance")));
            stats.setAgentCode(rs.getString("agent_code"));
            stats.setSetid(rs.getString("setid"));
            stats.setStmtDate(rs.getString("stmt_date"));
            stats.setBranCode(rs.getString("bran_code"));
            stats.setCorrAccNo(rs.getString("corr_acc_no"));
            stats.setTotalItems(rs.getLong("total_items"));
            stats.setAutomatchItems(rs.getLong("automatch_items"));
            stats.setTotalManualMatchCount(rs.getLong("manual_match_count"));
            return stats;
        });
    }

    // Merge automatch and manual match data by common keys
    private List<MergedReconStats> mergeAutomatchAndManualData(List<AutomatchStats> automatchData, 
                                                              List<ManualMatchStats> manualData) {
        Map<String, MergedReconStats> mergedMap = new HashMap<>();
        logger.info("Merging automatch data size: {}, manual data size: {}", automatchData.size(), manualData.size());
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

    // Build breaks query without date filter
    private String buildBreaksQueryWithoutDateFilter(TlmStatsRequest request) {
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
        // No date filter here - will filter in Java
        sql.append(" GROUP BY");
        sql.append("   s.agent_code,");
        sql.append("   s.local_acc_no,");
        sql.append("   i.stmt_date,");
        sql.append("   i.bran_code");
        
        return sql.toString();
    }
    
    // Build breaks query with filters
    private String buildBreaksQuery(TlmStatsRequest request, boolean countOnly) {
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
            sql.append(" SELECT SUM(breaks_count) FROM (");
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
    private String buildAutomatchQuery(TlmStatsRequest request) {
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

    // Build reconmgmt-only query that combines automatch and manual match data
    private String buildReconmgmtOnlyQuery(TlmStatsRequest request) {
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT ");
        sql.append("  tlm_instance, ");
        sql.append("  agent_code, ");
        sql.append("  setid, ");
        sql.append("  stmt_date, ");
        sql.append("  bran_code, ");
        sql.append("  corr_acc_no, ");
        sql.append("  SUM(total_item) as total_items, ");
        sql.append("  SUM(automatch_items) as automatch_items, ");
        sql.append("  SUM(manualmatch_items) as manual_match_count ");
        sql.append("  FROM reconmgmt.mr_csum_man_match_stats_hist ");
        sql.append("  WHERE ").append(getDateRangeClause(request.getDateRange(), "stmt_date"));
        
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
        
        sql.append("GROUP BY tlm_instance, agent_code, setid, stmt_date, bran_code, corr_acc_no ");
        sql.append("ORDER BY agent_code, setid, stmt_date, bran_code, corr_acc_no");
        
        return sql.toString();
    }
    
    // Build parameters for reconmgmt-only query
    private Object[] buildReconmgmtOnlyParameters(TlmStatsRequest request) {
        List<Object> params = new ArrayList<>();
        
        if (request.getTlmInstance() != null) {
            params.add(TLM_INSTANCE_MAP.get(request.getTlmInstance()));
        }
        if (request.getAgentCodes() != null && !request.getAgentCodes().isEmpty()) {
            params.addAll(request.getAgentCodes());
        }
        if (request.getSetIds() != null && !request.getSetIds().isEmpty()) {
            params.addAll(request.getSetIds());
        }
        
        return params.toArray();
    }
    
    // Build manual match query with filters
    private String buildManualMatchQuery(TlmStatsRequest request) {
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
    private Object[] buildBreaksParameters(TlmStatsRequest request) {
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
    private Object[] buildAutomatchParameters(TlmStatsRequest request) {
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
    private Object[] buildManualMatchParameters(TlmStatsRequest request) {
        List<Object> params = new ArrayList<>();
        
        // First part of UNION
        if (request.getTlmInstance() != null) {
            params.add(TLM_INSTANCE_MAP.get(request.getTlmInstance()));
        }
        if (request.getAgentCodes() != null && !request.getAgentCodes().isEmpty()) {
            params.addAll(request.getAgentCodes());
        }
        if (request.getSetIds() != null && !request.getSetIds().isEmpty()) {
            params.addAll(request.getSetIds());
        }
        
        // Second part of UNION (same parameters repeated)
        if (request.getTlmInstance() != null) {
            params.add(TLM_INSTANCE_MAP.get(request.getTlmInstance()));
        }
        if (request.getAgentCodes() != null && !request.getAgentCodes().isEmpty()) {
            params.addAll(request.getAgentCodes());
        }
        if (request.getSetIds() != null && !request.getSetIds().isEmpty()) {
            params.addAll(request.getSetIds());
        }
        
        return params.toArray();
    }

    // Get total breaks count for summary
    private long getTotalBreaksCount(String tlmInstance, List<String> agentCodes, List<String> setIds, int dateRange, String entryPoint) {
        JdbcTemplate jdbcTemplate = tlmJdbcTemplateFactory.getJdbcTemplate(tlmInstance);
        
        TlmStatsRequest tempRequest = createTempRequest(tlmInstance, agentCodes, setIds, dateRange, entryPoint);
        
        // If entry point is recon or tlm_instance, we need to fetch all and filter in Java
        if ("recon".equals(entryPoint) || "tlm_instance".equals(entryPoint)) {
            List<BreakStats> allBreaks = getBreaksWithoutDateFilter(tempRequest);
            List<BreakStats> filteredBreaks = filterBreaksByDate(allBreaks, dateRange);
            return filteredBreaks.stream().mapToLong(BreakStats::getBreaksCount).sum();
        } else {
            String sql = buildBreaksQuery(tempRequest, true);
            Object[] params = buildBreaksParameters(tempRequest);
            Long count = jdbcTemplate.queryForObject(sql, params, Long.class);
            return count != null ? count : 0L;
        }
    }

    // Create temporary request for summary calculations
    private TlmStatsRequest createTempRequest(String tlmInstance, List<String> agentCodes, List<String> setIds, int dateRange, String entryPoint) {
        TlmStatsRequest request = new TlmStatsRequest();
        request.setTlmInstance(tlmInstance);
        request.setAgentCodes(agentCodes);
        request.setSetIds(setIds);
        request.setDateRange(dateRange);
        request.setEntryPoint(entryPoint);
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
            TLM_INSTANCE_MAP.get(rs.getString("tlm_instance")),
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
            TLM_INSTANCE_MAP.get(rs.getString("tlm_instance")),
            rs.getString("agent_code"),
            rs.getString("setid"),
            rs.getString("stmt_date"),
            rs.getString("bran_code"),
            rs.getString("corr_acc_no"),
            rs.getLong("total_manual_match_count")
        );
    }
}