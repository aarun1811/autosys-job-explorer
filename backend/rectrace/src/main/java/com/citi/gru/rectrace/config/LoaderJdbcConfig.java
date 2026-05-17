package com.citi.gru.rectrace.config;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Phase 6 / LOADER-06 — exposes a {@link JdbcTemplate} bean named {@code loaderJdbcTemplate}
 * wrapping the primary RECTRACE {@link DataSource}.
 *
 * <p>Per D-6.16 the loader subsystem runs against the primary datasource (read+write capable)
 * rather than the Phase 5 readonly pool. Declaring this bean here — separate from
 * {@code ReadonlyDataSourceConfig} and {@code DataSourceConfig} — keeps the loader's JDBC
 * surface explicit and lets {@code @Profile("!test")} match the primary {@code DataSource}
 * bean's profile guard so the test profile boots without it.
 *
 * <p>{@code LoaderRunHistoryService} injects this template by qualifier name.
 */
@Profile("!test")
@Configuration
public class LoaderJdbcConfig {

    @Bean(name = "loaderJdbcTemplate")
    public JdbcTemplate loaderJdbcTemplate(@Qualifier("dataSource") DataSource ds) {
        return new JdbcTemplate(ds);
    }
}
