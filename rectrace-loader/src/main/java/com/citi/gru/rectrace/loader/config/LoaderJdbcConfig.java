package com.citi.gru.rectrace.loader.config;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Loader's {@link JdbcTemplate} wrapper around the primary RECTRACE Oracle {@link DataSource},
 * used by {@code LoaderRunHistoryService} for run-record persistence and by ShedLock for
 * lock-table reads against the {@code shedlock} table. Exposed as {@code loaderJdbcTemplate}
 * and consumed by qualifier — there is only one JdbcTemplate bean in this module so no
 * {@code @Primary} marker is required.
 *
 * <p>{@code @Profile("!test")} matches the profile guard on the primary {@link DataSource}
 * bean so the test profile boots without it (the contextLoads test excludes
 * {@code DataSourceAutoConfiguration}).
 */
@Profile("!test")
@Configuration
public class LoaderJdbcConfig {

    @Bean(name = "loaderJdbcTemplate")
    public JdbcTemplate loaderJdbcTemplate(@Qualifier("dataSource") DataSource ds) {
        return new JdbcTemplate(ds);
    }
}
