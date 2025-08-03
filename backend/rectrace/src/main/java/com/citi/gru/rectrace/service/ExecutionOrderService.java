package com.citi.gru.rectrace.service;

import java.io.Reader;
import java.io.StringWriter;
import java.math.BigDecimal;
import java.sql.Clob;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.persistence.Query;

import org.springframework.stereotype.Service;

import com.citi.gru.rectrace.dto.ExecutionOrderDTO;
import com.citi.gru.rectrace.dto.ExecutionOrderDTO.JobDetailsDTO;
import com.citi.gru.rectrace.dto.ExecutionOrderDTO.JobNodeDTO;

@Service
public class ExecutionOrderService {

    @PersistenceContext
    private EntityManager em;

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

        List<ExecutionOrderDTO.JobNodeDTO> sequence = new ArrayList<>();
        for (Object[] row : rows) {
            ExecutionOrderDTO.JobNodeDTO node = new ExecutionOrderDTO.JobNodeDTO();
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
                                + "ad2.run_calendar, "
                                + "ad2.exclude_calendar, "
                                + "ad.box_name, "
                                + "ad.command, "
                                + "ad.description "
                                + "FROM AUTOSYS_ALL_JOBS_DATA ad "
                                + "LEFT JOIN AUTOSYS_ALL_JOBS_DATA ad2 ON ad2.insert_job = ad.box_name "
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
//            details.setCommand(clobToString((Clob) row[6]));
//            details.setDescription(clobToString((Clob) row[7]));
            details.setCommand("");
            details.setDescription("");

            jobDetails.put((String) row[0], details);
        }
        result.setJobDetails(jobDetails);

        return result;
    }

    private String clobToString(Clob clob) {
        if (clob == null) return "";
        try (Reader reader = clob.getCharacterStream();
             StringWriter writer = new StringWriter()) {
            char[] buffer = new char[2048];
            int bytesRead;
            while ((bytesRead = reader.read(buffer)) != -1) {
                writer.write(buffer, 0, bytesRead);
            }
            return writer.toString();
        } catch (Exception e) {
            System.err.println("Error reading CLOB");
            return "";
        }
    }
}
