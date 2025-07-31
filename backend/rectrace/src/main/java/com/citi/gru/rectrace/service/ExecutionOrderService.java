package com.citi.gru.rectrace.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.persistence.Query;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import com.citi.gru.rectrace.dto.ExecutionOrderDTO;
import com.citi.gru.rectrace.dto.ExecutionOrderDTO.JobDetailsDTO;
import com.citi.gru.rectrace.dto.ExecutionOrderDTO.JobNodeDTO;

@Service
public class ExecutionOrderService {

    @PersistenceContext
    private EntityManager em;

    @PersistenceContext
    @Qualifier("autosysEntityManagerFactory")
    private EntityManager autosysEm;

    public ExecutionOrderDTO getExecutionOrder(String loadJobName) {
        ExecutionOrderDTO result = new ExecutionOrderDTO();
        
        String sequenceSql = "SELECT "
                                + "ts.job_name, "
                                + "ts.load_job, "
                                + "ts.exec_order "
                                + "FROM AUTOSYS_TLM_RECON_SEQUENCES ts "
                                + "WHERE ts.load_job = :loadJobName "
                                + "ORDER BY ts.exec_order";

        Query query = em.createNativeQuery(sequenceSql);
        query.setParameter("loadJobName", loadJobName);

        @SuppressWarnings("unchecked") 
        List<Object[]> rows = query.getResultList();

        if (rows.isEmpty()) {
            return result;
        }

        result.setLoadJob((String) rows.get(0)[1]);

        List<JobNodeDTO> sequence = new ArrayList<>();
        for (Object[] row : rows) {
            JobNodeDTO node = new JobNodeDTO();
            node.setJobName((String) row[0]);
            node.setLoadJob((String) row[1]);
            node.setExecutionOrder(((BigDecimal) row[2]).intValue());
            sequence.add(node);
        }
        result.setExecutionSequence(sequence);

        String jobDetailsSql = "SELECT "
                                + "ad.insert_job, "
                                + "ad.job_type, "
                                + "ad.machine, "
                                + "ad.run_calendar, "
                                + "ad.exclude_calendar, "
                                + "ad.box_name, "
                                + "ad.command, "
                                + "ad.description "
                                + "FROM AUTOSYS_ALL_JOBS_DATA ad "
                                + "WHERE ad.insert_job IN :jobNames";

        List<String> jobNames = new ArrayList<>();
        for (JobNodeDTO node : sequence) {
            jobNames.add(node.getJobName());
        }
        jobNames.add(result.getLoadJob()); // Add load job to get its details too

        Query detailsQuery = em.createNativeQuery(jobDetailsSql);
        detailsQuery.setParameter("jobNames", jobNames);

        @SuppressWarnings("unchecked")
        List<Object[]> detailsRows = detailsQuery.getResultList();

        Map<String, JobDetailsDTO> jobDetails = new HashMap<>();
        for (Object[] row : detailsRows) {
            JobDetailsDTO details = new JobDetailsDTO();
            details.setJobType((String) row[1]);
            details.setMachine((String) row[2]);
            details.setRunCalendar((String) row[3]);
            details.setExcludeCalendar((String) row[4]);
            details.setBoxName((String) row[5]);
            details.setCommand("");
            details.setDescription("");
            
            jobDetails.put((String) row[0], details);
        }
        result.setJobDetails(jobDetails);

        return result;
    }

    /**
     * Enhanced version of getExecutionOrder that includes job status and next start time
     */
    public ExecutionOrderDTO getExecutionOrderV2(String loadJobName) {
        ExecutionOrderDTO result = new ExecutionOrderDTO();
        
        // Get execution sequence (same as v1)
        String sequenceSql = "SELECT "
                                + "ts.job_name, "
                                + "ts.load_job, "
                                + "ts.exec_order "
                                + "FROM AUTOSYS_TLM_RECON_SEQUENCES ts "
                                + "WHERE ts.load_job = :loadJobName "
                                + "ORDER BY ts.exec_order";

        Query query = em.createNativeQuery(sequenceSql);
        query.setParameter("loadJobName", loadJobName);

        @SuppressWarnings("unchecked") 
        List<Object[]> rows = query.getResultList();

        if (rows.isEmpty()) {
            return result;
        }

        result.setLoadJob((String) rows.get(0)[1]);

        List<JobNodeDTO> sequence = new ArrayList<>();
        for (Object[] row : rows) {
            JobNodeDTO node = new JobNodeDTO();
            node.setJobName((String) row[0]);
            node.setLoadJob((String) row[1]);
            node.setExecutionOrder(((BigDecimal) row[2]).intValue());
            sequence.add(node);
        }
        result.setExecutionSequence(sequence);

        // Get job details from the main table
        String jobDetailsSql = "SELECT "
                                + "ad.insert_job, "
                                + "ad.job_type, "
                                + "ad.machine, "
                                + "ad.run_calendar, "
                                + "ad.exclude_calendar, "
                                + "ad.box_name, "
                                + "ad.command, "
                                + "ad.description "
                                + "FROM AUTOSYS_ALL_JOBS_DATA ad "
                                + "WHERE ad.insert_job IN :jobNames";

        List<String> jobNames = new ArrayList<>();
        for (JobNodeDTO node : sequence) {
            jobNames.add(node.getJobName());
        }
        jobNames.add(result.getLoadJob()); // Add load job to get its details too

        Query detailsQuery = em.createNativeQuery(jobDetailsSql);
        detailsQuery.setParameter("jobNames", jobNames);

        @SuppressWarnings("unchecked")
        List<Object[]> detailsRows = detailsQuery.getResultList();

        Map<String, JobDetailsDTO> jobDetails = new HashMap<>();
        for (Object[] row : detailsRows) {
            JobDetailsDTO details = new JobDetailsDTO();
            details.setJobType((String) row[1]);
            details.setMachine((String) row[2]);
            details.setRunCalendar((String) row[3]);
            details.setExcludeCalendar((String) row[4]);
            details.setBoxName((String) row[5]);
            details.setCommand((String) row[6]);
            details.setDescription((String) row[7]);
            
            // Initialize v2 fields with null values
            details.setStatus(null);
            details.setNextStartTime(null);
            details.setIsScheduledToday(null);
            
            jobDetails.put((String) row[0], details);
        }
        result.setJobDetails(jobDetails);

        // Fetch autosys data from separate database
        fetchAutosysJobData(jobNames, jobDetails);

        return result;
    }

    /**
     * Fetches autosys job data (status, next start time, is scheduled today) from the autosys database
     * and updates the jobDetails map with this information
     */
    private void fetchAutosysJobData(List<String> jobNames, Map<String, JobDetailsDTO> jobDetails) {
        if (jobNames.isEmpty()) {
            return;
        }

        // Updated query to fetch raw numeric status and epoch timestamp
        String autosysDataSql = "SELECT "
                                + "ld.job_name, "           // Replace with actual column name
                                + "ld.status, "             // Numeric status code
                                + "ld.next_start "          // Epoch timestamp
                                + "FROM AUTOSYS_LIVE_DATA ld "  // Replace with actual table name
                                + "WHERE ld.job_name IN :jobNames";

        Query autosysDataQuery = autosysEm.createNativeQuery(autosysDataSql);
        autosysDataQuery.setParameter("jobNames", jobNames);

        @SuppressWarnings("unchecked")
        List<Object[]> autosysDataRows = autosysDataQuery.getResultList();

        // Update jobDetails with autosys data
        for (Object[] row : autosysDataRows) {
            String jobName = (String) row[0];
            JobDetailsDTO details = jobDetails.get(jobName);
            
            if (details != null) {
                // Convert numeric status to readable string
                details.setStatus(convertStatusToString(row[1]));
                
                // Convert epoch timestamp to readable date/time
                details.setNextStartTime(convertEpochToReadableTime(row[2]));
                
                // Determine if scheduled today based on next start time
                details.setIsScheduledToday(isScheduledToday(row[2]));
            }
        }
    }

    /**
     * Converts numeric status codes to readable status strings
     */
    private String convertStatusToString(Object statusObj) {
        if (statusObj == null) {
            return "UNKNOWN";
        }
        
        int statusCode;
        if (statusObj instanceof Number) {
            statusCode = ((Number) statusObj).intValue();
        } else if (statusObj instanceof String) {
            try {
                statusCode = Integer.parseInt((String) statusObj);
            } catch (NumberFormatException e) {
                return "UNKNOWN";
            }
        } else {
            return "UNKNOWN";
        }
        
        switch (statusCode) {
            case 1: return "RUNNING";
            case 2: return "SUCCESS";
            case 3: return "FAILURE";
            case 4: return "TERMINATED";
            case 5: return "ON_ICE";
            case 6: return "ON_HOLD";
            case 7: return "INACTIVE";
            case 8: return "QUEUED";
            case 9: return "STARTING";
            case 10: return "RESTART";
            default: return "UNKNOWN";
        }
    }

    /**
     * Converts epoch timestamp to readable date/time string
     */
    private String convertEpochToReadableTime(Object epochObj) {
        if (epochObj == null) {
            return null;
        }
        
        long epochSeconds;
        if (epochObj instanceof Number) {
            epochSeconds = ((Number) epochObj).longValue();
        } else if (epochObj instanceof String) {
            try {
                epochSeconds = Long.parseLong((String) epochObj);
            } catch (NumberFormatException e) {
                return null;
            }
        } else {
            return null;
        }
        
        // Convert seconds to milliseconds if needed
        long epochMillis = epochSeconds;
        if (epochSeconds < 10000000000L) { // If less than year 2286, assume seconds
            epochMillis = epochSeconds * 1000;
        }
        
        try {
            java.time.Instant instant = java.time.Instant.ofEpochMilli(epochMillis);
            java.time.ZonedDateTime zonedDateTime = instant.atZone(java.time.ZoneId.systemDefault());
            return zonedDateTime.format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Determines if a job is scheduled to run today based on its next start time
     */
    private Boolean isScheduledToday(Object epochObj) {
        if (epochObj == null) {
            return false;
        }
        
        long epochSeconds;
        if (epochObj instanceof Number) {
            epochSeconds = ((Number) epochObj).longValue();
        } else if (epochObj instanceof String) {
            try {
                epochSeconds = Long.parseLong((String) epochObj);
            } catch (NumberFormatException e) {
                return false;
            }
        } else {
            return false;
        }
        
        // Convert seconds to milliseconds if needed
        long epochMillis = epochSeconds;
        if (epochSeconds < 10000000000L) { // If less than year 2286, assume seconds
            epochMillis = epochSeconds * 1000;
        }
        
        try {
            java.time.Instant instant = java.time.Instant.ofEpochMilli(epochMillis);
            java.time.ZonedDateTime nextStartTime = instant.atZone(java.time.ZoneId.systemDefault());
            java.time.ZonedDateTime today = java.time.ZonedDateTime.now(java.time.ZoneId.systemDefault());
            
            // Check if next start time is today (same date)
            return nextStartTime.toLocalDate().equals(today.toLocalDate());
        } catch (Exception e) {
            return false;
        }
    }
} 