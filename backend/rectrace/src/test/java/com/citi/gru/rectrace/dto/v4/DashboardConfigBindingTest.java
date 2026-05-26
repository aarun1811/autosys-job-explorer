package com.citi.gru.rectrace.dto.v4;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class DashboardConfigBindingTest {
    private final ObjectMapper om = new ObjectMapper();

    @Test
    void categoryWithDashboardBindsAllFields() throws Exception {
        String json = """
            {"key":"k","label":"L","searchColumn":"c",
             "dashboard":{"url":"https://x/embed?term={q}","title":"T","defaultOpen":true,"height":320}}
            """;
        CategoryConfigV4 cfg = om.readValue(json, CategoryConfigV4.class);
        assertThat(cfg.getDashboard()).isNotNull();
        assertThat(cfg.getDashboard().getUrl()).isEqualTo("https://x/embed?term={q}");
        assertThat(cfg.getDashboard().getTitle()).isEqualTo("T");
        assertThat(cfg.getDashboard().getDefaultOpen()).isTrue();
        assertThat(cfg.getDashboard().getHeight()).isEqualTo(320);
    }

    @Test
    void categoryWithoutDashboardLeavesItNull() throws Exception {
        CategoryConfigV4 cfg = om.readValue("{\"key\":\"k\",\"label\":\"L\",\"searchColumn\":\"c\"}", CategoryConfigV4.class);
        assertThat(cfg.getDashboard()).isNull();
    }

    @Test
    void resultSerializesDashboardWithCamelCaseKeys() throws Exception {
        CategoryResultV4 r = CategoryResultV4.builder()
            .key("k").label("L")
            .dashboard(DashboardConfig.builder().url("u").title("t").defaultOpen(false).height(200).build())
            .build();
        String out = om.writeValueAsString(r);
        assertThat(out).contains("\"dashboard\"").contains("\"defaultOpen\":false").contains("\"url\":\"u\"");
    }
}
