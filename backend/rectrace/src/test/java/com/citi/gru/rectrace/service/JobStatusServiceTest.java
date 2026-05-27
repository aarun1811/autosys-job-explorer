package com.citi.gru.rectrace.service;

import static org.mockito.Mockito.when;

import java.sql.ResultSet;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Assertions;
import org.mockito.Mockito;

import com.citi.gru.rectrace.dto.JobStatusInfo;

/**
 * Locks the column->DTO mapping done by the extracted
 * {@link JobStatusService.JobStatusRowMapper}: the six ujo_job_status runtime
 * columns + uj.owner thread into JobStatusInfo, nulls are tolerated (jobs with
 * no run history), and the FAILED path (status 5) resolves correctly.
 *
 * <p>Plain unit test — no Spring context, no live Oracle. The mapper is exercised
 * against a Mockito-mocked {@link ResultSet}, which is exactly what
 * NamedParameterJdbcTemplate would hand it row-by-row.
 */
class JobStatusServiceTest {

    @Test
    void mapsAllRuntimeColumnsAndOwner() throws Exception {
        ResultSet rs = Mockito.mock(ResultSet.class);
        when(rs.getString("job_name")).thenReturn("RECON-XYZ-42");
        when(rs.getString("owner")).thenReturn("svc_xyz_recon");
        when(rs.getObject("status", Integer.class)).thenReturn(5);
        when(rs.getObject("next_start", Long.class)).thenReturn(1747344000L);
        when(rs.getObject("last_start", Long.class)).thenReturn(1747252800L);
        when(rs.getObject("last_end", Long.class)).thenReturn(1747253280L);
        when(rs.getObject("run_num", Integer.class)).thenReturn(37);
        when(rs.getObject("ntry", Integer.class)).thenReturn(2);
        when(rs.getObject("exit_code", Integer.class)).thenReturn(1);
        when(rs.getString("run_machine")).thenReturn("ap-xyz07");

        JobStatusInfo info = JobStatusService.JOB_STATUS_ROW_MAPPER.mapRow(rs, 0);

        Assertions.assertEquals("RECON-XYZ-42", info.getJobName());
        Assertions.assertEquals("svc_xyz_recon", info.getOwner());
        Assertions.assertEquals(JobStatusInfo.VisualState.FAILED, info.getVisualState());
        Assertions.assertEquals(1747252800L, info.getLastStartEpoch());
        Assertions.assertEquals(1747253280L, info.getLastEndEpoch());
        Assertions.assertEquals(37, info.getRunNum());
        Assertions.assertEquals(2, info.getRetries());
        Assertions.assertEquals(1, info.getExitCode());
        Assertions.assertEquals("ap-xyz07", info.getRunMachine());
        Assertions.assertNotNull(info.getLastStartFormatted());
        Assertions.assertNotNull(info.getLastEndFormatted());
    }

    @Test
    void tolerantOfNullRuntimeColumns() throws Exception {
        // A WAITING job (status 7) with no run history: every runtime column is
        // SQL NULL, which rs.getObject(col, T.class) returns as Java null.
        ResultSet rs = Mockito.mock(ResultSet.class);
        when(rs.getString("job_name")).thenReturn("LOAD_COMMOD_RECON_005");
        when(rs.getString("owner")).thenReturn("svc_commod_recon");
        when(rs.getObject("status", Integer.class)).thenReturn(7);
        when(rs.getObject("next_start", Long.class)).thenReturn(1747430400L);
        when(rs.getObject("last_start", Long.class)).thenReturn(null);
        when(rs.getObject("last_end", Long.class)).thenReturn(null);
        when(rs.getObject("run_num", Integer.class)).thenReturn(null);
        when(rs.getObject("ntry", Integer.class)).thenReturn(null);
        when(rs.getObject("exit_code", Integer.class)).thenReturn(null);
        when(rs.getString("run_machine")).thenReturn(null);

        JobStatusInfo info = JobStatusService.JOB_STATUS_ROW_MAPPER.mapRow(rs, 0);

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
    void mapsCompletedRowWithZeroExitCode() throws Exception {
        // A COMPLETED job (status 4) with a clean run: exit_code 0 is a real
        // value (must not be coerced to null).
        ResultSet rs = Mockito.mock(ResultSet.class);
        when(rs.getString("job_name")).thenReturn("LOAD_TRADE_RECON_001");
        when(rs.getString("owner")).thenReturn("svc_trade_recon");
        when(rs.getObject("status", Integer.class)).thenReturn(4);
        when(rs.getObject("next_start", Long.class)).thenReturn(1747084800L);
        when(rs.getObject("last_start", Long.class)).thenReturn(1746998400L);
        when(rs.getObject("last_end", Long.class)).thenReturn(1747000500L);
        when(rs.getObject("run_num", Integer.class)).thenReturn(412);
        when(rs.getObject("ntry", Integer.class)).thenReturn(0);
        when(rs.getObject("exit_code", Integer.class)).thenReturn(0);
        when(rs.getString("run_machine")).thenReturn("na-trade01");

        JobStatusInfo info = JobStatusService.JOB_STATUS_ROW_MAPPER.mapRow(rs, 0);

        Assertions.assertEquals(JobStatusInfo.VisualState.COMPLETED, info.getVisualState());
        Assertions.assertEquals(0, info.getExitCode());
        Assertions.assertEquals(0, info.getRetries());
        Assertions.assertEquals(412, info.getRunNum());
    }
}
