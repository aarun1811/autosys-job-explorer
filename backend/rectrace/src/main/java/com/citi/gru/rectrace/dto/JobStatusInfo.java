package com.citi.gru.rectrace.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobStatusInfo {
    
    private String jobName;
    private Integer status;
    private String statusName;
    private Long nextStart; // Epoch timestamp
    private boolean isScheduledToday;
    private boolean hasRunToday;
    private boolean isCurrentlyActive;
    private VisualState visualState;
    private String statusColor;
    private String statusIcon;
    
    public enum VisualState {
        COMPLETED_TODAY,  // Job already ran today (muted colors)
        ACTIVE_NOW,       // Job is currently running/starting (emphasized)
        CURRENT_STATE     // Show current state (normal colors)
    }
    
    public enum AutoSysStatus {
        RUNNING(1, "RUNNING", "▶"),
        STARTING(3, "STARTING", "⟳"),
        SUCCESS(4, "SUCCESS", "✓"),
        FAILURE(5, "FAILURE", "✗"),
        TERMINATED(6, "TERMINATED", "⊗"),
        ON_ICE(7, "ON_ICE", "❄"),
        INACTIVE(8, "INACTIVE", "○"),
        ACTIVATED(9, "ACTIVATED", "⏰"),
        RESTART(10, "RESTART", "🔄"),
        ON_HOLD(11, "ON_HOLD", "⏸"),
        QUE_WAIT(12, "QUE_WAIT", "⏳");
        
        private final int code;
        private final String name;
        private final String icon;
        
        AutoSysStatus(int code, String name, String icon) {
            this.code = code;
            this.name = name;
            this.icon = icon;
        }
        
        public static AutoSysStatus fromCode(int code) {
            for (AutoSysStatus status : values()) {
                if (status.code == code) {
                    return status;
                }
            }
            return INACTIVE;
        }
        
        public int getCode() { return code; }
        public String getName() { return name; }
        public String getIcon() { return icon; }
    }
    
    public static JobStatusInfo fromDatabase(String jobName, Integer statusCode, Long nextStartEpoch) {
        JobStatusInfo info = new JobStatusInfo();
        info.setJobName(jobName);
        info.setStatus(statusCode);
        
        AutoSysStatus status = AutoSysStatus.fromCode(statusCode != null ? statusCode : 8);
        info.setStatusName(status.getName());
        info.setStatusIcon(status.getIcon());
        
        // Determine if scheduled today
        if (nextStartEpoch != null && nextStartEpoch > 0) {
            info.setNextStart(nextStartEpoch);
            LocalDate nextStartDate = Instant.ofEpochSecond(nextStartEpoch)
                    .atZone(ZoneId.systemDefault())
                    .toLocalDate();
            LocalDate today = LocalDate.now();
            info.setScheduledToday(nextStartDate.equals(today));
        } else {
            info.setScheduledToday(false);
        }
        
        // Determine visual state based on status and schedule
        info.determineVisualState();
        
        return info;
    }
    
    private void determineVisualState() {
        if (status == null) {
            this.visualState = VisualState.CURRENT_STATE;
            this.isCurrentlyActive = false;
            this.hasRunToday = false;
            return;
        }
        
        // Check if job is currently active
        this.isCurrentlyActive = (status == 1 || status == 3 || status == 12); // RUNNING, STARTING, QUE_WAIT
        
        // Check if job has completed today
        boolean isCompletedStatus = (status == 4 || status == 5 || status == 6); // SUCCESS, FAILURE, TERMINATED
        this.hasRunToday = isScheduledToday && isCompletedStatus;
        
        // Determine visual state
        if (hasRunToday) {
            this.visualState = VisualState.COMPLETED_TODAY;
        } else if (isCurrentlyActive) {
            this.visualState = VisualState.ACTIVE_NOW;
        } else if (isScheduledToday && status == 9) { // ACTIVATED and scheduled today
            this.visualState = VisualState.ACTIVE_NOW;
            this.isCurrentlyActive = true; // Treat as active since it's waiting to run today
        } else {
            this.visualState = VisualState.CURRENT_STATE;
        }
    }
}