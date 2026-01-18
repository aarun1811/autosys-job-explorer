package com.citi.gru.rectrace.quickrec.service;

import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import com.citi.gru.rectrace.quickrec.model.QuickRecAutoMatchStats;
import com.citi.gru.rectrace.quickrec.model.QuickRecDashboardSummary;
import com.citi.gru.rectrace.quickrec.model.QuickRecManualMatchStats;
import com.citi.gru.rectrace.quickrec.model.QuickRecStatsRequest;

/**
 * Service class for executing QuickRec statistics queries
 */
@Service
public class QuickRecStatsService {
    
    private static final Logger logger = LoggerFactory.getLogger(QuickRecStatsService.class);
    
    @Autowired
    @Qualifier("reconmgmtJdbcTemplate")
    private JdbcTemplate reconmgmtJdbcTemplate;
    
    @Autowired
    @Qualifier("recportalJdbcTemplate")
    private JdbcTemplate recportalJdbcTemplate;
    
    /**
     * Get auto-match statistics from reconmgmt database
     */
    public List<QuickRecAutoMatchStats> getAutoMatchStats(QuickRecStatsRequest request) {
        logger.info("Fetching QuickRec auto-match stats for request: {}", request);
        
        String sql = buildAutoMatchQuery(request);
        Object[] params = buildAutoMatchParameters(request);
        
        return reconmgmtJdbcTemplate.query(sql, params, getAutoMatchStatsRowMapper());
    }
    
    /**
     * Get manual match statistics from recportal database
     */
    public List<QuickRecManualMatchStats> getManualMatchStats(QuickRecStatsRequest request) {
        logger.info("Fetching QuickRec manual match stats for request: {}", request);
        
        String sql = buildManualMatchQuery(request);
        Object[] params = buildManualMatchParameters(request);
        
        return recportalJdbcTemplate.query(sql, params, getManualMatchStatsRowMapper());
    }
    
    /**
     * Get dashboard summary combining both auto and manual match data
     */
    public QuickRecDashboardSummary getDashboardSummary(QuickRecStatsRequest request) {
        logger.info("Fetching QuickRec dashboard summary for request: {}", request);
        
        // Get auto-match data
        List<QuickRecAutoMatchStats> autoMatchData = getAutoMatchStats(request);
        
        // Get manual match data
        List<QuickRecManualMatchStats> manualMatchData = getManualMatchStats(request);
        
        // Calculate summary
        return calculateSummary(autoMatchData, manualMatchData);
    }
    
    /**
     * Build SQL query for auto-match statistics
     */
    private String buildAutoMatchQuery(QuickRecStatsRequest request) {
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT ");
        sql.append("  reconname, ");
        sql.append("  recon_id, ");
        sql.append("  rec_portal_id, ");
        sql.append("  left_record_count, ");
        sql.append("  right_record_count, ");
        sql.append("  left_break_count, ");
        sql.append("  right_break_count, ");
        sql.append("  left_match_count, ");
        sql.append("  right_match_count, ");
        sql.append("  load_date ");
        sql.append("FROM quickrec_stats_table ");
        sql.append("WHERE 1=1 ");
        
        // Add filters
        if (request.getReconId() != null && !request.getReconId().isEmpty()) {
            sql.append(" AND recon_id = ? ");
        }
        
        if (request.getRecPortalId() != null && !request.getRecPortalId().isEmpty()) {
            sql.append(" AND rec_portal_id = ? ");
        }
        
        // Add date range filter on load_date
        sql.append(" AND ").append(getDateRangeClause(request.getDateRange(), "load_date"));
        
        sql.append(" ORDER BY load_date DESC, reconname");
        
        return sql.toString();
    }
    
    /**
     * Build SQL query for manual match statistics
     */
    private String buildManualMatchQuery(QuickRecStatsRequest request) {
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT ");
        sql.append("  rec_portal_id, ");
        sql.append("  COB, ");
        sql.append("  UPDATED_DATE, ");
        sql.append("  LEFT_MANUAL_MATCHES, ");
        sql.append("  RIGHT_MANUAL_MATCHES ");
        sql.append("FROM recportal_manual_match_table ");
        sql.append("WHERE 1=1 ");
        
        // Add filters
        if (request.getRecPortalId() != null && !request.getRecPortalId().isEmpty()) {
            sql.append(" AND rec_portal_id = ? ");
        }
        
        // Add date range filter on updated_date
        sql.append(" AND ").append(getDateRangeClause(request.getDateRange(), "UPDATED_DATE"));
        
        sql.append(" ORDER BY UPDATED_DATE DESC, rec_portal_id");
        
        return sql.toString();
    }
    
    /**
     * Get date range clause based on days
     */
    private String getDateRangeClause(int days, String dateColumn) {
        if (days == 1) {
            // Business day logic for 1 day
            return dateColumn + " BETWEEN TRUNC(SYSDATE) - " +
                   "(DECODE(TO_CHAR(SYSDATE, 'D'), 1, 1, 2, 3, 3, 1, 4, 1, 5, 1, 6, 1, 7, 1)) " +
                   "AND SYSDATE";
        } else {
            // Calendar days for 7 and 30 days
            return dateColumn + " BETWEEN SYSDATE - " + days + " AND SYSDATE";
        }
    }
    
    /**
     * Build parameters for auto-match query
     */
    private Object[] buildAutoMatchParameters(QuickRecStatsRequest request) {
        List<Object> params = new ArrayList<>();
        
        if (request.getReconId() != null && !request.getReconId().isEmpty()) {
            params.add(request.getReconId());
        }
        
        if (request.getRecPortalId() != null && !request.getRecPortalId().isEmpty()) {
            params.add(request.getRecPortalId());
        }
        
        return params.toArray();
    }
    
    /**
     * Build parameters for manual match query
     */
    private Object[] buildManualMatchParameters(QuickRecStatsRequest request) {
        List<Object> params = new ArrayList<>();
        
        if (request.getRecPortalId() != null && !request.getRecPortalId().isEmpty()) {
            params.add(request.getRecPortalId());
        }
        
        return params.toArray();
    }
    
    /**
     * Calculate dashboard summary from auto and manual match data
     */
    private QuickRecDashboardSummary calculateSummary(
            List<QuickRecAutoMatchStats> autoMatchData,
            List<QuickRecManualMatchStats> manualMatchData) {
        
        // Sum up auto-match statistics
        Long totalLeftRecords = autoMatchData.stream()
            .mapToLong(stat -> stat.getLeftRecordCount() != null ? stat.getLeftRecordCount() : 0L)
            .sum();
        
        Long totalRightRecords = autoMatchData.stream()
            .mapToLong(stat -> stat.getRightRecordCount() != null ? stat.getRightRecordCount() : 0L)
            .sum();
        
        Long totalLeftBreaks = autoMatchData.stream()
            .mapToLong(stat -> stat.getLeftBreakCount() != null ? stat.getLeftBreakCount() : 0L)
            .sum();
        
        Long totalRightBreaks = autoMatchData.stream()
            .mapToLong(stat -> stat.getRightBreakCount() != null ? stat.getRightBreakCount() : 0L)
            .sum();
        
        Long totalLeftAutoMatches = autoMatchData.stream()
            .mapToLong(stat -> stat.getLeftMatchCount() != null ? stat.getLeftMatchCount() : 0L)
            .sum();
        
        Long totalRightAutoMatches = autoMatchData.stream()
            .mapToLong(stat -> stat.getRightMatchCount() != null ? stat.getRightMatchCount() : 0L)
            .sum();
        
        // Sum up manual match statistics
        Long totalLeftManualMatches = manualMatchData.stream()
            .mapToLong(stat -> stat.getLeftManualMatches() != null ? stat.getLeftManualMatches() : 0L)
            .sum();
        
        Long totalRightManualMatches = manualMatchData.stream()
            .mapToLong(stat -> stat.getRightManualMatches() != null ? stat.getRightManualMatches() : 0L)
            .sum();
        
        return new QuickRecDashboardSummary(
            totalLeftRecords, totalRightRecords,
            totalLeftBreaks, totalRightBreaks,
            totalLeftAutoMatches, totalRightAutoMatches,
            totalLeftManualMatches, totalRightManualMatches
        );
    }
    
    /**
     * Row mapper for auto-match statistics
     */
    private RowMapper<QuickRecAutoMatchStats> getAutoMatchStatsRowMapper() {
        return (rs, rowNum) -> new QuickRecAutoMatchStats(
            rs.getString("reconname"),
            rs.getString("recon_id"),
            rs.getString("rec_portal_id"),
            rs.getLong("left_record_count"),
            rs.getLong("right_record_count"),
            rs.getLong("left_break_count"),
            rs.getLong("right_break_count"),
            rs.getLong("left_match_count"),
            rs.getLong("right_match_count"),
            rs.getString("load_date")
        );
    }
    
    /**
     * Row mapper for manual match statistics
     */
    private RowMapper<QuickRecManualMatchStats> getManualMatchStatsRowMapper() {
        return (rs, rowNum) -> new QuickRecManualMatchStats(
            rs.getString("rec_portal_id"),
            rs.getString("COB"),
            rs.getString("UPDATED_DATE"),
            rs.getLong("LEFT_MANUAL_MATCHES"),
            rs.getLong("RIGHT_MANUAL_MATCHES")
        );
    }
}