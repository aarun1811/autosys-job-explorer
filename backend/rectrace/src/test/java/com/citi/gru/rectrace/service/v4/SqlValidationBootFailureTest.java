package com.citi.gru.rectrace.service.v4;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.test.util.ReflectionTestUtils;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Phase 5 / SQL-02 + SQL-05 — boot-failure path proof for the
 * {@code @PostConstruct} validation gate.
 *
 * <p>Wave 4 (Plan 05-04): enabled. We deliberately instantiate
 * {@link SqlSearchConfigServiceV4} directly with a {@link DefaultResourceLoader} and call
 * {@code init()} so the assertion targets the raw {@link IllegalStateException} message
 * without {@code @SpringBootTest} wrapping it in {@code BeanCreationException}. This
 * mirrors the production cause-chain — Spring would re-throw this exact exception during
 * context init.
 */
class SqlValidationBootFailureTest {

    private static SqlSearchConfigServiceV4 newServiceWithConfig(String classpathLocation) {
        SqlSearchConfigServiceV4 svc = new SqlSearchConfigServiceV4(
            new DefaultResourceLoader(),
            new ObjectMapper());
        ReflectionTestUtils.setField(svc, "configLocation", classpathLocation);
        return svc;
    }

    @Test
    void rejectsInsertStatement() {
        SqlSearchConfigServiceV4 svc =
            newServiceWithConfig("classpath:sql-search-config-bad-insert.json");

        assertThatThrownBy(svc::init)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("bad")
            .hasMessageContaining("not a SELECT");
    }

    @Test
    void rejectsUnboundedSelect() {
        SqlSearchConfigServiceV4 svc =
            newServiceWithConfig("classpath:sql-search-config-bad-unbounded.json");

        assertThatThrownBy(svc::init)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("unbounded")
            .hasMessageContaining("missing both WHERE and FETCH");
    }

    @Test
    void acceptsValidCte() {
        SqlSearchConfigServiceV4 svc =
            newServiceWithConfig("classpath:sql-search-config-cte.json");

        svc.init(); // must not throw
        assertThat(svc.getTabs()).hasSize(1);
        assertThat(svc.getTabs().get(0).getKey()).isEqualTo("cte");
    }

    @Test
    void acceptsProductionConfig() {
        SqlSearchConfigServiceV4 svc =
            newServiceWithConfig("classpath:sql-search-config-v4.json");

        svc.init(); // must not throw — production config must always satisfy the gate
        assertThat(svc.getTabs())
            .extracting(t -> t.getKey())
            .contains("reconSummary");
    }

    @Test
    void toleratesMissingConfigFile() {
        SqlSearchConfigServiceV4 svc =
            newServiceWithConfig("classpath:sql-search-config-does-not-exist.json");

        svc.init(); // missing file is non-fatal — empty tabs list
        assertThat(svc.getTabs()).isEmpty();
    }
}
