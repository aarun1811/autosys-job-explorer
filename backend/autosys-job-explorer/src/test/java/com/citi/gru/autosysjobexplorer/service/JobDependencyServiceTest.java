package com.citi.gru.autosysjobexplorer.service;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import javax.persistence.EntityManager;
import javax.persistence.Query;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.anyString;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.citi.gru.autosysjobexplorer.dto.JobDependencyDTO;

@ExtendWith(MockitoExtension.class)
public class JobDependencyServiceTest {

    @Mock
    private EntityManager em;

    @Mock
    private Query sequenceQuery;

    @Mock
    private Query conditionsQuery;

    @InjectMocks
    private JobDependencyService jobDependencyService;

    @BeforeEach
    void setUp() {
        when(em.createNativeQuery(anyString())).thenReturn(sequenceQuery, conditionsQuery);
    }

    @Test
    void whenNoJobsFound_thenReturnEmptyDependencies() {
        // Given
        String loadJobName = "testLoadJob";
        when(sequenceQuery.getResultList()).thenReturn(Arrays.asList());

        // When
        JobDependencyDTO result = jobDependencyService.getJobDependencies(loadJobName);

        // Then
        assertNotNull(result);
        assertEquals(loadJobName, result.getLoadJob());
        assertTrue(result.getDependencies().isEmpty());
        verify(sequenceQuery).setParameter("loadJobName", loadJobName);
    }

    @Test
    void whenJobsFoundWithConditions_thenReturnParsedDependencies() {
        // Given
        String loadJobName = "testLoadJob";
        List<String> jobNames = Arrays.asList("jobA", "jobB", "jobC");
        when(sequenceQuery.getResultList()).thenReturn(jobNames);

        Object[] row1 = new Object[]{"jobA", "s(jobX) & s(jobY)"};
        Object[] row2 = new Object[]{"jobB", "s(jobZ)"};
        Object[] row3 = new Object[]{"jobC", null};
        when(conditionsQuery.getResultList()).thenReturn(Arrays.asList(row1, row2, row3));

        // When
        JobDependencyDTO result = jobDependencyService.getJobDependencies(loadJobName);

        // Then
        assertNotNull(result);
        assertEquals(loadJobName, result.getLoadJob());
        
        Map<String, List<String>> dependencies = result.getDependencies();
        assertEquals(3, dependencies.size());
        
        assertEquals(Arrays.asList("jobX", "jobY"), dependencies.get("jobA"));
        assertEquals(Arrays.asList("jobZ"), dependencies.get("jobB"));
        assertTrue(dependencies.get("jobC").isEmpty());

        verify(sequenceQuery).setParameter("loadJobName", loadJobName);
        verify(conditionsQuery).setParameter("jobNames", jobNames);
    }

    @Test
    void whenInvalidConditionFormat_thenSkipInvalidParts() {
        // Given
        String loadJobName = "testLoadJob";
        List<String> jobNames = Arrays.asList("jobA");
        when(sequenceQuery.getResultList()).thenReturn(jobNames);

        Object[] row = new Object[]{"jobA", "s(jobX) & invalid & s(jobY) & notValid(jobZ)"};
        when(conditionsQuery.getResultList()).thenReturn(Arrays.asList(row));

        // When
        JobDependencyDTO result = jobDependencyService.getJobDependencies(loadJobName);

        // Then
        assertNotNull(result);
        List<String> jobDeps = result.getDependencies().get("jobA");
        assertEquals(2, jobDeps.size());
        assertTrue(jobDeps.containsAll(Arrays.asList("jobX", "jobY")));
    }
} 