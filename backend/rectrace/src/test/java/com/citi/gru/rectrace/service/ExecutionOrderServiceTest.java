package com.citi.gru.rectrace.service;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Assertions;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import com.citi.gru.rectrace.dto.ExecutionOrderDTO;

/**
 * Locks the {@link ExecutionOrderService} sequence-result handling against the
 * Hibernate numeric-type surprise: the native query's {@code exec_order}
 * ({@code NUMBER(10)}) column comes back as {@link Integer}, not
 * {@link java.math.BigDecimal}. The fragile {@code (BigDecimal)} cast threw
 * {@link ClassCastException} (HTTP 500) once the table became reachable; the
 * type-tolerant {@code (Number)} cast must accept it.
 *
 * <p>Plain unit test — no Spring context. {@code em} is field-injected via
 * {@link ReflectionTestUtils}; {@code jobStatusService} is null so the
 * live-status branch is skipped.
 */
class ExecutionOrderServiceTest {

    @Test
    void toleratesIntegerExecOrderFromNativeQuery() {
        EntityManager em = Mockito.mock(EntityManager.class);
        Query seqQuery = Mockito.mock(Query.class);
        Query detailsQuery = Mockito.mock(Query.class);

        // Route by SQL substring to the right query mock.
        when(em.createNativeQuery(contains("AUTOSYS_TLM_RECON_SEQUENCES"))).thenReturn(seqQuery);
        when(em.createNativeQuery(contains("AUTOSYS_ALL_JOBS_DATA"))).thenReturn(detailsQuery);

        // setParameter is fluent — return the same mock so the call chain works.
        when(seqQuery.setParameter(anyString(), Mockito.any())).thenReturn(seqQuery);
        when(detailsQuery.setParameter(anyString(), Mockito.any())).thenReturn(detailsQuery);

        // ONE sequence row with Integer in slot [2] — this is what reproduces the bug.
        List<Object[]> seqRows = new ArrayList<>();
        seqRows.add(new Object[] { "PRE-X", "X", Integer.valueOf(1) });
        when(seqQuery.getResultList()).thenReturn(seqRows);
        when(detailsQuery.getResultList()).thenReturn(Collections.emptyList());

        ExecutionOrderService service = new ExecutionOrderService(null);
        ReflectionTestUtils.setField(service, "em", em);

        ExecutionOrderDTO result = service.getExecutionOrder("X");

        Assertions.assertNotNull(result.getExecutionSequence());
        Assertions.assertEquals(1, result.getExecutionSequence().size());
        Assertions.assertEquals(1, result.getExecutionSequence().get(0).getExecutionOrder());
        Assertions.assertEquals("PRE-X", result.getExecutionSequence().get(0).getJobName());
    }
}
