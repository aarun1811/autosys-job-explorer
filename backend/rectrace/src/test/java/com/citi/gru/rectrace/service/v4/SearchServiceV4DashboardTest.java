package com.citi.gru.rectrace.service.v4;

import com.citi.gru.rectrace.dto.v4.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SearchServiceV4DashboardTest {
    @Mock SearchConfigServiceV4 configService;
    @Mock ElasticsearchServiceV4 esService;
    @InjectMocks SearchServiceV4 service;

    @Test
    void gridCategoryCarriesDashboardThrough() {
        DashboardConfig dash = DashboardConfig.builder().url("u").title("t").build();
        CategoryConfigV4 grid = CategoryConfigV4.builder()
            .key("jobName").label("Job Name")
            .elasticsearch(ElasticsearchConfig.builder().index("i").maxResults(1000).build())
            .dashboard(dash).columns(List.of()).build();
        when(configService.getCategories()).thenReturn(List.of(grid));
        when(esService.getUniqueValues(eq("term"), any())).thenReturn(List.of("A", "B"));

        InitialSearchResponseV4 resp = service.performInitialSearch("term");
        CategoryResultV4 r = resp.getCategoryResults().get("jobName");
        assertThat(r.getDashboard()).isSameAs(dash);
        assertThat(r.getCount()).isEqualTo(2);
    }

    @Test
    void dashboardOnlyCategoryAppearsWithoutEsSearch() {
        CategoryConfigV4 dashOnly = CategoryConfigV4.builder()
            .key("overview").label("Overview")
            .dashboard(DashboardConfig.builder().url("u").build())
            .build(); // no elasticsearch block
        when(configService.getCategories()).thenReturn(List.of(dashOnly));

        InitialSearchResponseV4 resp = service.performInitialSearch("term");
        CategoryResultV4 r = resp.getCategoryResults().get("overview");
        assertThat(r).isNotNull();
        assertThat(r.getDashboard()).isNotNull();
        assertThat(r.getValues()).isEmpty();
        assertThat(r.getColumns()).isNotNull();   // coalesced to empty list, never null (React Zod requires an array)
        verify(esService, never()).getUniqueValues(anyString(), any());
    }
}
