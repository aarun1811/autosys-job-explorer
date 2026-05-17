package com.citi.gru.rectrace.loader;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.test.util.ReflectionTestUtils;

import com.fasterxml.jackson.databind.ObjectMapper;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch.indices.ElasticsearchIndicesClient;
import co.elastic.clients.transport.endpoints.BooleanResponse;

/**
 * Phase 6 / LOADER-01 — boot-time validation contract for {@code LoaderConfigService}.
 *
 * <p>Plain JUnit + ReflectionTestUtils — no Spring context. The service is instantiated
 * directly, fields are injected, then {@code load()} is invoked. Each test runs in
 * single-digit ms.
 */
class LoaderConfigServiceTest {

    private LoaderConfigService newService(String classpathLocation, ElasticsearchClient esClient) {
        LoaderConfigService svc = new LoaderConfigService();
        ReflectionTestUtils.setField(svc, "configLocation", "classpath:" + classpathLocation);
        ReflectionTestUtils.setField(svc, "objectMapper", new ObjectMapper());
        ReflectionTestUtils.setField(svc, "resourceLoader", new DefaultResourceLoader());
        ReflectionTestUtils.setField(svc, "esClient", esClient);
        return svc;
    }

    private ElasticsearchClient esClientWhereAliasExists(boolean exists) {
        ElasticsearchClient esClient = mock(ElasticsearchClient.class);
        ElasticsearchIndicesClient indices = mock(ElasticsearchIndicesClient.class);
        when(esClient.indices()).thenReturn(indices);
        try {
            when(indices.existsAlias(any(java.util.function.Function.class)))
                    .thenReturn(new BooleanResponse(exists));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        return esClient;
    }

    @Test
    void loadsValidConfigAtBoot() {
        LoaderConfigService svc = newService("loader-config-good.json", esClientWhereAliasExists(true));

        svc.load();

        assertThat(svc.getJobs())
                .as("LOADER-01: getJobs() must return non-empty list after @PostConstruct")
                .hasSize(1);
        assertThat(svc.getJob("good_job")).isPresent();
        assertThat(svc.getJob("good_job").get().getTarget().getAlias()).isEqualTo("rectrace_core_alias");
    }

    @Test
    void rejectsDuplicateJobKeys() {
        LoaderConfigService svc = newService("loader-config-duplicate-keys.json",
                esClientWhereAliasExists(true));

        assertThatThrownBy(svc::load)
                .as("LOADER-01: duplicate job keys in loader-config must boot-fail")
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("duplicate")
                .hasMessageContaining("dupe");
    }

    @Test
    void rejectsBlankCron() {
        LoaderConfigService svc = newService("loader-config-blank-schedule.json",
                esClientWhereAliasExists(true));

        assertThatThrownBy(svc::load)
                .as("LOADER-01: blank cron schedule must boot-fail")
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("schedule");
    }

    @Test
    void failsBootIfAliasMissing() {
        // Pitfall L2 mitigation: alias declared in config but absent in cluster → boot fails.
        LoaderConfigService svc = newService("loader-config-missing-alias.json",
                esClientWhereAliasExists(false));

        assertThatThrownBy(svc::load)
                .as("LOADER-01 / LOADER-03 / Pitfall L2: missing alias must surface at boot")
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("alias")
                .hasMessageContaining("this_alias_does_not_exist");
    }
}
