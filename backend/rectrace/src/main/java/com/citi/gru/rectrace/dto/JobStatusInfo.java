package com.citi.gru.rectrace.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class JobStatusInfo {

    /**
     * Visual states for UI rendering - maps multiple Autosys statuses to color
     * groups
     */
    public enum VisualState {
        COMPLETED, // Green - SUCCESS
        RUNNING, // Blue - RUNNING, STARTING
        FAILED, // Red - FAILURE, TERMINATED
        WAITING, // Amber - YET_TO_RUN, QUE_WAIT, ACTIVATED, RESTART
        INACTIVE // Gray - ON_HOLD, ON_ICE, ON_NOEXEC, INACTIVE, PEND_MACH
    }

    private String jobName;
    private Integer status;
    private String statusName;
    private Long nextStartEpoch;
    private String nextStartFormatted;
    private boolean isScheduledToday;
    private boolean isCurrentlyActive;
    private VisualState visualState;

    // Runtime gold (spec §6.2) — epochs are SECONDS, formatted like next_start (IST).
    private Long lastStartEpoch;
    private String lastStartFormatted;
    private Long lastEndEpoch;
    private String lastEndFormatted;
    private Integer exitCode;
    private Integer runNum;
    private Integer retries; // from ujo_job_status.ntry (retries used)
    private String runMachine;
    private String owner; // from ujo_job.owner

    private static final DateTimeFormatter DISPLAY_FORMAT = DateTimeFormatter.ofPattern("MMM dd, h:mm a");

    // Private constructor - use builder or factory
    private JobStatusInfo() {
    }

    /**
     * Factory method to create JobStatusInfo from database values (status only).
     * Back-compat 3-arg form — delegates to the richer overload with null runtime.
     */
    public static JobStatusInfo fromDatabase(String jobName, Integer statusCode, Long nextStart) {
        return fromDatabase(jobName, statusCode, nextStart,
                null, null, null, null, null, null, null);
    }

    /**
     * Factory method including the runtime gold (spec §6.2). All runtime args are
     * null-tolerant: a job with no run history passes nulls and gets null runtime
     * fields (not errors). Epochs are SECONDS; the two new epoch pairs format via
     * the same {@link #formatNextStart} path used by next_start (IST).
     */
    public static JobStatusInfo fromDatabase(
            String jobName, Integer statusCode, Long nextStart,
            Long lastStart, Long lastEnd, Integer runNum, Integer ntry,
            Integer exitCode, String runMachine, String owner) {
        Builder builder = builder().jobName(jobName).status(statusCode);

        String statusName = mapStatusCodeToName(statusCode);
        VisualState visualState = mapStatusCodeToVisualState(statusCode);
        boolean scheduledToday = isScheduledForToday(nextStart);
        boolean isInactiveOrActivated = statusCode != null && (statusCode == 8 || statusCode == 3);

        // YET_TO_RUN logic: if scheduled today AND job is inactive/activated
        if (scheduledToday && isInactiveOrActivated) {
            statusName = "Yet to Run";
            visualState = VisualState.WAITING;
        }

        builder.statusName(statusName)
                .visualState(visualState)
                .nextStartEpoch(nextStart)
                .nextStartFormatted(formatNextStart(nextStart))
                .isScheduledToday(scheduledToday)
                .isCurrentlyActive(isActiveStatus(statusCode))
                .lastStartEpoch(lastStart)
                .lastStartFormatted(formatNextStart(lastStart))
                .lastEndEpoch(lastEnd)
                .lastEndFormatted(formatNextStart(lastEnd))
                .runNum(runNum)
                .retries(ntry)
                .exitCode(exitCode)
                .runMachine(runMachine)
                .owner(owner);

        return builder.build();
    }

    /**
     * Maps Autosys numeric status code to human-readable name (Title Case)
     */
    private static String mapStatusCodeToName(Integer statusCode) {
        if (statusCode == null)
            return "Unknown";
        switch (statusCode) {
            case 1:
                return "Running";
            case 2:
                return "Starting";
            case 3:
                return "Activated";
            case 4:
                return "Success";
            case 5:
                return "Failure";
            case 6:
                return "Terminated";
            case 7:
                return "Restart";
            case 8:
                return "Inactive";
            case 9:
                return "On Hold";
            case 10:
                return "On Ice";
            case 11:
                return "On Noexec";
            case 12:
                return "Queue Wait";
            case 13:
                return "Pend Machine";
            default:
                return "Unknown";
        }
    }

    /**
     * Maps Autosys status code to one of 5 visual states for UI coloring
     */
    private static VisualState mapStatusCodeToVisualState(Integer statusCode) {
        if (statusCode == null)
            return VisualState.INACTIVE;
        switch (statusCode) {
            case 1: // Running
            case 2: // Starting
                return VisualState.RUNNING;
            case 4: // Success
                return VisualState.COMPLETED;
            case 5: // Failure
            case 6: // Terminated
                return VisualState.FAILED;
            case 3:
            case 7:
            case 12:
                return VisualState.WAITING;
            default:
                return VisualState.INACTIVE;
        }
    }

    /**
     * Determine if job is scheduled for today based on next start date
     */
    private static boolean isScheduledForToday(Long nextStartEpoch) {
        if (nextStartEpoch == null || nextStartEpoch <= 0) {
            return false;
        }
        try {
            LocalDate nextStartDate = Instant.ofEpochSecond(nextStartEpoch)
                    .atZone(ZoneId.systemDefault())
                    .toLocalDate();
            return nextStartDate.isEqual(LocalDate.now());
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Format next start date for display (e.g., "Mar 25, 10:30 AM")
     */
    private static String formatNextStart(Long nextStartEpoch) {
        if (nextStartEpoch == null || nextStartEpoch <= 0) {
            return null;
        }
        try {
            return Instant.ofEpochSecond(nextStartEpoch)
                    .atZone(ZoneId.systemDefault())
                    .format(DISPLAY_FORMAT);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Determine if job is currently active (Running or Starting)
     */
    private static boolean isActiveStatus(Integer statusCode) {
        return statusCode != null && (statusCode == 1 || statusCode == 2);
    }

    // Getters and setters
    public String getJobName() {
        return jobName;
    }

    public void setJobName(String jobName) {
        this.jobName = jobName;
    }

    public Integer getStatus() {
        return status;
    }

    public void setStatus(Integer status) {
        this.status = status;
    }

    public String getStatusName() {
        return statusName;
    }

    public void setStatusName(String statusName) {
        this.statusName = statusName;
    }

    public Long getNextStartEpoch() {
        return nextStartEpoch;
    }

    public void setNextStartEpoch(Long nextStartEpoch) {
        this.nextStartEpoch = nextStartEpoch;
    }

    public String getNextStartFormatted() {
        return nextStartFormatted;
    }

    public void setNextStartFormatted(String nextStartFormatted) {
        this.nextStartFormatted = nextStartFormatted;
    }

    public boolean isScheduledToday() {
        return isScheduledToday;
    }

    public void setScheduledToday(boolean scheduledToday) {
        this.isScheduledToday = scheduledToday;
    }

    public boolean isCurrentlyActive() {
        return isCurrentlyActive;
    }

    public void setCurrentlyActive(boolean currentlyActive) {
        this.isCurrentlyActive = currentlyActive;
    }

    public VisualState getVisualState() {
        return visualState;
    }

    public void setVisualState(VisualState visualState) {
        this.visualState = visualState;
    }

    public Long getLastStartEpoch() {
        return lastStartEpoch;
    }

    public void setLastStartEpoch(Long lastStartEpoch) {
        this.lastStartEpoch = lastStartEpoch;
    }

    public String getLastStartFormatted() {
        return lastStartFormatted;
    }

    public void setLastStartFormatted(String lastStartFormatted) {
        this.lastStartFormatted = lastStartFormatted;
    }

    public Long getLastEndEpoch() {
        return lastEndEpoch;
    }

    public void setLastEndEpoch(Long lastEndEpoch) {
        this.lastEndEpoch = lastEndEpoch;
    }

    public String getLastEndFormatted() {
        return lastEndFormatted;
    }

    public void setLastEndFormatted(String lastEndFormatted) {
        this.lastEndFormatted = lastEndFormatted;
    }

    public Integer getExitCode() {
        return exitCode;
    }

    public void setExitCode(Integer exitCode) {
        this.exitCode = exitCode;
    }

    public Integer getRunNum() {
        return runNum;
    }

    public void setRunNum(Integer runNum) {
        this.runNum = runNum;
    }

    public Integer getRetries() {
        return retries;
    }

    public void setRetries(Integer retries) {
        this.retries = retries;
    }

    public String getRunMachine() {
        return runMachine;
    }

    public void setRunMachine(String runMachine) {
        this.runMachine = runMachine;
    }

    public String getOwner() {
        return owner;
    }

    public void setOwner(String owner) {
        this.owner = owner;
    }

    // Builder pattern
    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private JobStatusInfo jobStatusInfo;

        private Builder() {
            this.jobStatusInfo = new JobStatusInfo();
        }

        public Builder jobName(String jobName) {
            jobStatusInfo.jobName = jobName;
            return this;
        }

        public Builder status(Integer status) {
            jobStatusInfo.status = status;
            return this;
        }

        public Builder statusName(String statusName) {
            jobStatusInfo.statusName = statusName;
            return this;
        }

        public Builder nextStartEpoch(Long nextStartEpoch) {
            jobStatusInfo.nextStartEpoch = nextStartEpoch;
            return this;
        }

        public Builder nextStartFormatted(String nextStartFormatted) {
            jobStatusInfo.nextStartFormatted = nextStartFormatted;
            return this;
        }

        public Builder isScheduledToday(boolean isScheduledToday) {
            jobStatusInfo.isScheduledToday = isScheduledToday;
            return this;
        }

        public Builder isCurrentlyActive(boolean isCurrentlyActive) {
            jobStatusInfo.isCurrentlyActive = isCurrentlyActive;
            return this;
        }

        public Builder visualState(VisualState visualState) {
            jobStatusInfo.visualState = visualState;
            return this;
        }

        public Builder lastStartEpoch(Long lastStartEpoch) {
            jobStatusInfo.lastStartEpoch = lastStartEpoch;
            return this;
        }

        public Builder lastStartFormatted(String lastStartFormatted) {
            jobStatusInfo.lastStartFormatted = lastStartFormatted;
            return this;
        }

        public Builder lastEndEpoch(Long lastEndEpoch) {
            jobStatusInfo.lastEndEpoch = lastEndEpoch;
            return this;
        }

        public Builder lastEndFormatted(String lastEndFormatted) {
            jobStatusInfo.lastEndFormatted = lastEndFormatted;
            return this;
        }

        public Builder exitCode(Integer exitCode) {
            jobStatusInfo.exitCode = exitCode;
            return this;
        }

        public Builder runNum(Integer runNum) {
            jobStatusInfo.runNum = runNum;
            return this;
        }

        public Builder retries(Integer retries) {
            jobStatusInfo.retries = retries;
            return this;
        }

        public Builder runMachine(String runMachine) {
            jobStatusInfo.runMachine = runMachine;
            return this;
        }

        public Builder owner(String owner) {
            jobStatusInfo.owner = owner;
            return this;
        }

        public JobStatusInfo build() {
            return jobStatusInfo;
        }
    }

    @Override
    public String toString() {
        return "JobStatusInfo{" +
                "jobName='" + jobName + '\'' +
                ", status=" + status +
                ", statusName='" + statusName + '\'' +
                ", nextStartDateEpoch=" + nextStartEpoch +
                ", nextStartFormatted='" + nextStartFormatted + '\'' +
                ", isScheduledToday=" + isScheduledToday +
                ", isCurrentlyActive=" + isCurrentlyActive +
                ", visualState=" + visualState +
                '}';
    }
}
