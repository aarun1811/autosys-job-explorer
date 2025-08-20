package com.citi.gru.rectrace.tlmstats.service;

import java.util.ArrayList;
import java.util.List;

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

/**
 * Service class for executing TLM statistics queries
 */
@Service
public class TlmStatsService {

    private static final Logger logger = LoggerFactory.getLogger(TlmStatsService.class);

    @Autowired
    private DatabaseConfig.TlmJdbcTemplateFactory tlmJdbcTemplateFactory;

    @Autowired
    private JdbcTemplate reconmgmtJdbcTemplate;

    /**
     * Executes the Break Stats query
     */
    public List<BreakStats> getBreakStats(String tlmInstance, String localAccNo, String agentCode) {
        validateTlmInstance(tlmInstance);
        validateBreakStatsParameters(localAccNo, agentCode);

        JdbcTemplate jdbcTemplate = tlmJdbcTemplateFactory.getJdbcTemplate(tlmInstance);
        
        String sql = buildBreakStatsQuery(localAccNo, agentCode);
        Object[] params = buildBreakStatsParameters(localAccNo, agentCode);
        
        logger.info("Executing Break Stats query for TLM instance: {}", tlmInstance);
        
        return jdbcTemplate.query(sql, params, getBreakStatsRowMapper());
    }

    /**
     * Executes the Automatch Stats query
     */
    public List<AutomatchStats> getAutomatchStats(String tlmInstance, String localAccNo, String agentCode) {
        validateTlmInstance(tlmInstance);
        validateAutomatchStatsParameters(localAccNo, agentCode);

        JdbcTemplate jdbcTemplate = tlmJdbcTemplateFactory.getJdbcTemplate(tlmInstance);
        
        String sql = buildAutomatchStatsQuery(localAccNo, agentCode);
        Object[] params = buildAutomatchStatsParameters(localAccNo, agentCode);
        
        logger.info("Executing Automatch Stats query for TLM instance: {}", tlmInstance);
        
        return jdbcTemplate.query(sql, params, getAutomatchStatsRowMapper());
    }

    /**
     * Executes the Manual Match Stats query
     */
    public List<ManualMatchStats> getManualMatchStats(String setId, String agentCode, String tlmInstance) {
        validateManualMatchStatsParameters(setId, agentCode);

        String sql = buildManualMatchStatsQuery(setId, agentCode, tlmInstance);
        Object[] params = buildManualMatchStatsParameters(setId, agentCode, tlmInstance);
        
        logger.info("Executing Manual Match Stats query");
        
        return reconmgmtJdbcTemplate.query(sql, params, getManualMatchStatsRowMapper());
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

    private void validateBreakStatsParameters(String localAccNo, String agentCode) {
        if ((localAccNo == null || localAccNo.trim().isEmpty()) && 
            (agentCode == null || agentCode.trim().isEmpty())) {
            throw new IllegalArgumentException("Either local_acc_no or agent_code must be provided");
        }
    }

    private void validateAutomatchStatsParameters(String localAccNo, String agentCode) {
        if ((localAccNo == null || localAccNo.trim().isEmpty()) && 
            (agentCode == null || agentCode.trim().isEmpty())) {
            throw new IllegalArgumentException("Either local_acc_no or agent_code must be provided");
        }
    }

    private void validateManualMatchStatsParameters(String setId, String agentCode) {
        if ((setId == null || setId.trim().isEmpty()) && 
            (agentCode == null || agentCode.trim().isEmpty())) {
            throw new IllegalArgumentException("Either set_id or agent_code must be provided");
        }
    }

    // Query building methods
    private String buildBreakStatsQuery(String localAccNo, String agentCode) {
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
        sql.append("    bank     k,");
        sql.append("    message_feed f");
        sql.append("  WHERE");
        sql.append("    f.corr_acc_no = k.corr_acc_no");
        
        if (localAccNo != null && !localAccNo.trim().isEmpty()) {
            sql.append("    AND k.local_acc_no = ?");
        }
        if (agentCode != null && !agentCode.trim().isEmpty()) {
            sql.append("    AND k.agent_code = ?");
        }
        
        sql.append(")");
        sql.append("SELECT");
        sql.append("  COUNT(*) AS breaks_count,");
        sql.append("  s.agent_code,");
        sql.append("  s.local_acc_no,");
        sql.append("  s.stmt_date,");
        sql.append("  i.bran_code");
        sql.append("FROM");
        sql.append("  item  i,");
        sql.append("  static s");
        sql.append("WHERE");
        sql.append("  s.corr_acc_no = i.corr_acc_no");
        sql.append("  AND i.flag_2 = 0");
        sql.append("GROUP BY");
        sql.append("  s.agent_code,");
        sql.append("  s.local_acc_no,");
        sql.append("  s.stmt_date,");
        sql.append("  i.bran_code");
        
        return sql.toString();
    }

    private String buildAutomatchStatsQuery(String localAccNo, String agentCode) {
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT");
        sql.append("  sys_context('USERENV', 'DB_NAME') tlm_instance,");
        sql.append("  b.agent_code           agent_code,");
        sql.append("  b.local_acc_no          setid,");
        sql.append("  i.stmt_date            stmt_date,");
        sql.append("  i.bran_code            bran_code,");
        sql.append("  b.corr_acc_no           corr_acc_no,");
        sql.append("  SUM(");
        sql.append("    CASE");
        sql.append("      WHEN i.flag_2 IN(0, 1, 11) THEN");
        sql.append("        1");
        sql.append("      ELSE");
        sql.append("        0");
        sql.append("    END");
        sql.append("  )                 total_items,");
        sql.append("  SUM(");
        sql.append("    CASE");
        sql.append("      WHEN th.last_action_owner IN('SYSTEM', 'system', 'AUTONET')");
        sql.append("         AND i.flag_2 = 1 THEN");
        sql.append("        1");
        sql.append("      ELSE");
        sql.append("        0");
        sql.append("    END");
        sql.append("  )                 automatch_items");
        sql.append("FROM");
        sql.append("  bank            b,");
        sql.append("  message_feed        mf,");
        sql.append("  item            i,");
        sql.append("  tlm_bdr_relationship_header th");
        sql.append("WHERE");
        sql.append("  b.corr_acc_no = mf.corr_acc_no");
        sql.append("  AND mf.corr_acc_no = i.corr_acc_no");
        sql.append("  AND mf.short_code = i.short_no");
        sql.append("  AND i.relationship_id = th.relationship_id (+)");
        sql.append("  AND mf.mlnv NOT IN ( '9060', '9066' )");
        sql.append("  AND i.stmt_date BETWEEN (");
        sql.append("    SELECT");
        sql.append("      trunc(sysdate) - ( decode(to_char(sysdate, 'D'), 1, 1, 2, 3,");
        sql.append("                   3, 1, 4, 1, 5,");
        sql.append("                   1, 6, 1, 7, 1) )");
        sql.append("    FROM");
        sql.append("      dual");
        sql.append("  ) AND sysdate - 1");
        
        if (localAccNo != null && !localAccNo.trim().isEmpty()) {
            sql.append("  AND b.local_acc_no = ?");
        }
        if (agentCode != null && !agentCode.trim().isEmpty()) {
            sql.append("  AND b.agent_code = ?");
        }
        
        sql.append("GROUP BY");
        sql.append("  b.agent_code,");
        sql.append("  b.local_acc_no,");
        sql.append("  i.stmt_date,");
        sql.append("  i.bran_code,");
        sql.append("  b.corr_acc_no");
        sql.append("ORDER BY");
        sql.append("  b.agent_code,");
        sql.append("  b.local_acc_no,");
        sql.append("  i.stmt_date,");
        sql.append("  i.bran_code,");
        sql.append("  b.corr_acc_no");
        
        return sql.toString();
    }

    private String buildManualMatchStatsQuery(String setId, String agentCode, String tlmInstance) {
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT");
        sql.append("  tlm_instance,");
        sql.append("  agent_code,");
        sql.append("  setid,");
        sql.append("  stmt_date,");
        sql.append("  bran_code,");
        sql.append("  corr_acc_no,");
        sql.append("  SUM(manual_match_count) AS total_manual_match_count");
        sql.append("FROM");
        sql.append("  (");
        sql.append("    SELECT");
        sql.append("      COUNT(*) AS manual_match_count,");
        sql.append("      agent_code,");
        sql.append("      setid,");
        sql.append("      corr_acc_no,");
        sql.append("      bran_code,");
        sql.append("      tlm_instance,");
        sql.append("      stmt_date");
        sql.append("    FROM");
        sql.append("      reconmgmt.mr_csum_man_match_details");
        sql.append("    WHERE");
        sql.append("      stmt_date BETWEEN TRUNC(SYSDATE) - (DECODE(TO_CHAR(SYSDATE, 'D'), 1, 1, 2, 3,");
        sql.append("                            3, 1, 4, 1, 5,");
        sql.append("                            1, 6, 1, 7, 1))");
        sql.append("              AND TRUNC(SYSDATE) - 1");
        
        if (setId != null && !setId.trim().isEmpty()) {
            sql.append("      AND setid = ?");
        }
        if (agentCode != null && !agentCode.trim().isEmpty()) {
            sql.append("      AND agent_code = ?");
        }
        if (tlmInstance != null && !tlmInstance.trim().isEmpty()) {
            sql.append("      AND tlm_instance = ?");
        }
        
        sql.append("    GROUP BY");
        sql.append("      agent_code,");
        sql.append("      setid,");
        sql.append("      corr_acc_no,");
        sql.append("      bran_code,");
        sql.append("      tlm_instance,");
        sql.append("      stmt_date");
        sql.append("    UNION ALL");
        sql.append("    SELECT");
        sql.append("      COUNT(*)   AS manual_match_count,");
        sql.append("      agent_code,");
        sql.append("      local_acc_no AS setid,");
        sql.append("      corr_acc_no,");
        sql.append("      bran_code,");
        sql.append("      tlm_instance,");
        sql.append("      stmt_date");
        sql.append("    FROM");
        sql.append("      reconmgmt.mr_csum_netting_hist");
        sql.append("    WHERE");
        sql.append("      stmt_date BETWEEN TRUNC(SYSDATE) - (DECODE(TO_CHAR(SYSDATE, 'D'), 1, 1, 2, 3,");
        sql.append("                            3, 1, 4, 1, 5,");
        sql.append("                            1, 6, 1, 7, 1))");
        sql.append("              AND TRUNC(SYSDATE) - 1");
        
        if (setId != null && !setId.trim().isEmpty()) {
            sql.append("      AND local_acc_no = ?");
        }
        if (agentCode != null && !agentCode.trim().isEmpty()) {
            sql.append("      AND agent_code = ?");
        }
        if (tlmInstance != null && !tlmInstance.trim().isEmpty()) {
            sql.append("      AND tlm_instance = ?");
        }
        
        sql.append("    GROUP BY");
        sql.append("      agent_code,");
        sql.append("      local_acc_no,");
        sql.append("      corr_acc_no,");
        sql.append("      bran_code,");
        sql.append("      tlm_instance,");
        sql.append("      stmt_date");
        sql.append("  ) combined_results");
        sql.append("GROUP BY");
        sql.append("  agent_code,");
        sql.append("  setid,");
        sql.append("  corr_acc_no,");
        sql.append("  bran_code,");
        sql.append("  tlm_instance,");
        sql.append("  stmt_date");
        
        return sql.toString();
    }

    // Parameter building methods
    private Object[] buildBreakStatsParameters(String localAccNo, String agentCode) {
        List<Object> params = new ArrayList<>();
        
        if (localAccNo != null && !localAccNo.trim().isEmpty()) {
            params.add(localAccNo);
        }
        if (agentCode != null && !agentCode.trim().isEmpty()) {
            params.add(agentCode);
        }
        
        return params.toArray();
    }

    private Object[] buildAutomatchStatsParameters(String localAccNo, String agentCode) {
        List<Object> params = new ArrayList<>();
        
        if (localAccNo != null && !localAccNo.trim().isEmpty()) {
            params.add(localAccNo);
        }
        if (agentCode != null && !agentCode.trim().isEmpty()) {
            params.add(agentCode);
        }
        
        return params.toArray();
    }

    private Object[] buildManualMatchStatsParameters(String setId, String agentCode, String tlmInstance) {
        List<Object> params = new ArrayList<>();
        
        // First part of UNION query parameters
        if (setId != null && !setId.trim().isEmpty()) {
            params.add(setId);
        }
        if (agentCode != null && !agentCode.trim().isEmpty()) {
            params.add(agentCode);
        }
        if (tlmInstance != null && !tlmInstance.trim().isEmpty()) {
            params.add(tlmInstance);
        }
        
        // Second part of UNION query parameters (same parameters repeated)
        if (setId != null && !setId.trim().isEmpty()) {
            params.add(setId);
        }
        if (agentCode != null && !agentCode.trim().isEmpty()) {
            params.add(agentCode);
        }
        if (tlmInstance != null && !tlmInstance.trim().isEmpty()) {
            params.add(tlmInstance);
        }
        
        return params.toArray();
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