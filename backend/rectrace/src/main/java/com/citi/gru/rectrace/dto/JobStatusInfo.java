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

    private static final DateTimeFormatter DISPLAY_FORMAT = DateTimeFormatter.ofPattern("MMM dd, h:mm a");

    // Private constructor - use builder or factory
    private JobStatusInfo() {
    }

    /**
     * Factory method to create JobStatusInfo from database values
     */
    public static JobStatusInfo fromDatabase(String jobName, Integer statusCode, Long nextStart) {
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
                .isCurrentlyActive(isActiveStatus(statusCode));

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
