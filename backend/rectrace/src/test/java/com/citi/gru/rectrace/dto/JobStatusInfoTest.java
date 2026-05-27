package com.citi.gru.rectrace.dto;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Assertions;

/**
 * Locks the extended {@link JobStatusInfo#fromDatabase} runtime-column factory
 * (spec §6.2): the seven runtime values thread through, epochs are SECONDS,
 * the two new epoch pairs format like next_start (IST), and nulls stay null.
 * Plain unit test — no Spring context, no DB.
 */
class JobStatusInfoTest {

    @Test
    void fullRowThreadsAllRuntimeFields() {
        JobStatusInfo info = JobStatusInfo.fromDatabase(
                "RECON-XYZ-42", 5, 1747344000L,
                1747252800L, 1747253280L, 37, 2, 1, "ap-xyz07", "svc_xyz_recon");

        Assertions.assertEquals("RECON-XYZ-42", info.getJobName());
        Assertions.assertEquals(JobStatusInfo.VisualState.FAILED, info.getVisualState());
        Assertions.assertEquals(1747252800L, info.getLastStartEpoch());
        Assertions.assertEquals(1747253280L, info.getLastEndEpoch());
        Assertions.assertEquals(37, info.getRunNum());
        Assertions.assertEquals(2, info.getRetries());
        Assertions.assertEquals(1, info.getExitCode());
        Assertions.assertEquals("ap-xyz07", info.getRunMachine());
        Assertions.assertEquals("svc_xyz_recon", info.getOwner());
        // Epoch -> formatted is non-null (formatted like next_start; IST).
        Assertions.assertNotNull(info.getLastStartFormatted());
        Assertions.assertNotNull(info.getLastEndFormatted());
    }

    @Test
    void nullRuntimeColumnsStayNull() {
        // A WAITING job with no run history: all runtime epochs/values null.
        JobStatusInfo info = JobStatusInfo.fromDatabase(
                "LOAD_COMMOD_RECON_005", 7, 1747430400L,
                null, null, null, null, null, null, "svc_commod_recon");

        Assertions.assertEquals(JobStatusInfo.VisualState.WAITING, info.getVisualState());
        Assertions.assertNull(info.getLastStartEpoch());
        Assertions.assertNull(info.getLastStartFormatted());
        Assertions.assertNull(info.getLastEndEpoch());
        Assertions.assertNull(info.getLastEndFormatted());
        Assertions.assertNull(info.getRunNum());
        Assertions.assertNull(info.getRetries());
        Assertions.assertNull(info.getExitCode());
        Assertions.assertNull(info.getRunMachine());
        Assertions.assertEquals("svc_commod_recon", info.getOwner());
    }

    @Test
    void threeArgFactoryStillWorksAndLeavesRuntimeNull() {
        // Back-compat: the original 3-arg factory keeps working; new fields null.
        JobStatusInfo info = JobStatusInfo.fromDatabase("LOAD-ABC-123", 4, 1747171200L);
        Assertions.assertEquals(JobStatusInfo.VisualState.COMPLETED, info.getVisualState());
        Assertions.assertNull(info.getLastStartEpoch());
        Assertions.assertNull(info.getOwner());
        Assertions.assertNull(info.getExitCode());
    }
}
