package com.citi.gru.rectrace.service;

import com.citi.gru.rectrace.dto.JobStatusInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.util.*;
import java.util.stream.Collectors;

@Service
@ConditionalOnBean(name = "autosysDataSource")
public class JobStatusService {
    
    private static final Logger logger = LoggerFactory.getLogger(JobStatusService.class);
    
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final String schema;
    
    @Autowired
    public JobStatusService(
            @Qualifier("autosysDataSource") DataSource autosysDataSource,
            @Value("${autosys.db.schema}") String schema) {
        this.jdbcTemplate = new NamedParameterJdbcTemplate(autosysDataSource);
        this.schema = schema;
        logger.info("JobStatusService initialized with schema: {}", schema);
    }
    
    /**
     * Fetch live job status for multiple jobs in a single query
     */
    public Map<String, JobStatusInfo> getBatchJobStatus(List<String> jobNames) {
        if (jobNames == null || jobNames.isEmpty()) {
            return Collections.emptyMap();
        }
        
        logger.debug("Fetching status for {} jobs from schema {}", jobNames.size(), schema);
        
        String sql = String.format(
            "SELECT uj.job_name, ujs.status, ujs.next_start " +
            "FROM %s.ujo_job uj " +
            "LEFT JOIN %s.ujo_job_status ujs ON uj.joid = ujs.joid " +
            "WHERE UPPER(uj.job_name) IN (:jobNames)",
            schema, schema
        );
        
        try {
            // Convert job names to uppercase for case-insensitive matching
            List<String> upperJobNames = jobNames.stream()
                    .map(String::toUpperCase)
                    .collect(Collectors.toList());
            
            MapSqlParameterSource parameters = new MapSqlParameterSource();
            parameters.addValue("jobNames", upperJobNames);
            
            List<JobStatusInfo> statusList = jdbcTemplate.query(sql, parameters, (rs, rowNum) -> {
                String jobName = rs.getString("job_name");
                Integer status = rs.getObject("status", Integer.class);
                Long nextStart = rs.getObject("next_start", Long.class);
                
                return JobStatusInfo.fromDatabase(jobName, status, nextStart);
            });
            
            // Convert to map for easy lookup
            Map<String, JobStatusInfo> statusMap = statusList.stream()
                    .collect(Collectors.toMap(
                            info -> info.getJobName().toUpperCase(),
                            info -> info,
                            (existing, replacement) -> existing // In case of duplicates, keep first
                    ));
            
            logger.debug("Successfully fetched status for {} jobs", statusMap.size());
            
            // Add default status for jobs not found in database
            for (String jobName : jobNames) {
                if (!statusMap.containsKey(jobName.toUpperCase())) {
                    logger.debug("Job {} not found in AutoSys, using default status", jobName);
                    statusMap.put(jobName.toUpperCase(), createDefaultStatus(jobName));
                }
            }
            
            return statusMap;
            
        } catch (Exception e) {
            logger.error("Error fetching job status from AutoSys database", e);
            // Return map with default status for all jobs
            return jobNames.stream()
                    .collect(Collectors.toMap(
                            String::toUpperCase,
                            this::createDefaultStatus
                    ));
        }
    }
    
    /**
     * Fetch status for a single job
     */
    public JobStatusInfo getJobStatus(String jobName) {
        Map<String, JobStatusInfo> result = getBatchJobStatus(Collections.singletonList(jobName));
        return result.getOrDefault(jobName.toUpperCase(), createDefaultStatus(jobName));
    }
    
    /**
     * Create default status for jobs not found or in case of error
     */
    private JobStatusInfo createDefaultStatus(String jobName) {
        return JobStatusInfo.builder()
                .jobName(jobName)
                .status(null) // INACTIVE
                .statusName("UNKNOWN")
                .isScheduledToday(false)
                .isCurrentlyActive(false)
                .visualState(JobStatusInfo.VisualState.CURRENT_STATE)
                .build();
    }
    
    /**
     * Test database connection
     */
    public boolean testConnection() {
        try {
            String sql = String.format("SELECT 1 FROM %s.ujo_job WHERE ROWNUM = 1", schema);
            jdbcTemplate.getJdbcTemplate().queryForObject(sql, Integer.class);
            logger.info("AutoSys database connection test successful for schema: {}", schema);
            return true;
        } catch (Exception e) {
            logger.error("AutoSys database connection test failed for schema: {}", schema, e);
            return false;
        }
    }
}