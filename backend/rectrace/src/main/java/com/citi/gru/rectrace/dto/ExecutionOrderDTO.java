package com.citi.gru.rectrace.dto;

import java.util.List;
import java.util.Map;

public class ExecutionOrderDTO {
    private String loadJob;
    private List<JobNodeDTO> executionSequence;
    private Map<String, JobDetailsDTO> jobDetails;

    // Nested DTO for each job node in the sequence
    public static class JobNodeDTO {
        private String jobName;
        private int executionOrder;
        private String loadJob;

        public String getJobName() {
            return jobName;
        }

        public void setJobName(String jobName) {
            this.jobName = jobName;
        }

        public int getExecutionOrder() {
            return executionOrder;
        }

        public void setExecutionOrder(int executionOrder) {
            this.executionOrder = executionOrder;
        }

        public String getLoadJob() {
            return loadJob;
        }

        public void setLoadJob(String loadJob) {
            this.loadJob = loadJob;
        }
    }

    // Nested DTO for job details
    public static class JobDetailsDTO {
        private String jobType;
        private String machine;
        private String runCalendar;
        private String excludeCalendar;
        private String boxName;
        private String command;
        private String description;

        public String getJobType() {
            return jobType;
        }

        public void setJobType(String jobType) {
            this.jobType = jobType;
        }

        public String getMachine() {
            return machine;
        }

        public void setMachine(String machine) {
            this.machine = machine;
        }

        public String getRunCalendar() {
            return runCalendar;
        }

        public void setRunCalendar(String runCalendar) {
            this.runCalendar = runCalendar;
        }

        public String getExcludeCalendar() {
            return excludeCalendar;
        }

        public void setExcludeCalendar(String excludeCalendar) {
            this.excludeCalendar = excludeCalendar;
        }

        public String getBoxName() {
            return boxName;
        }

        public void setBoxName(String boxName) {
            this.boxName = boxName;
        }

        public String getCommand() {
            return command;
        }

        public void setCommand(String command) {
            this.command = command;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }
    }

    // Getters and setters for main class
    public String getLoadJob() {
        return loadJob;
    }

    public void setLoadJob(String loadJob) {
        this.loadJob = loadJob;
    }

    public List<JobNodeDTO> getExecutionSequence() {
        return executionSequence;
    }

    public void setExecutionSequence(List<JobNodeDTO> executionSequence) {
        this.executionSequence = executionSequence;
    }

    public Map<String, JobDetailsDTO> getJobDetails() {
        return jobDetails;
    }

    public void setJobDetails(Map<String, JobDetailsDTO> jobDetails) {
        this.jobDetails = jobDetails;
    }
} 