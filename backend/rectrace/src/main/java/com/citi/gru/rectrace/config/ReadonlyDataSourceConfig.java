package com.citi.gru.rectrace.config;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;

import com.citi.gru.rectrace.util.ScriptExecutor;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import lombok.extern.slf4j.Slf4j;

/**
 * Phase 5 / SQL-03 + SQL-04 — dedicated read-only DataSource for the config-driven
 * SELECT tab. Authenticates as {@code rectrace_readonly} (CREATE SESSION + QUOTA 0 +
 * SELECT-only grant on {@code rectrace.rectrace_core}); HikariCP {@code setReadOnly(true)}
 * is the connection-level hint, the structural defense is the DB-side grant matrix.
 *
 * <p>The {@code readonlyJdbcTemplate} bean is deliberately bare: SQL-04 requires
 * per-statement caps (queryTimeout / fetchSize / maxRows) applied via
 * {@link org.springframework.jdbc.core.StatementCallback} inside
 * {@code SqlQueryServiceV4}, NOT as template-level setters. Configuring the singleton
 * template would silently apply caps to every consumer in the future — see Pitfall 7
 * in {@code 05-RESEARCH.md} and threat T-05-06.
 *
 * <p>{@code @Profile("!test")} mirrors {@link DataSourceConfig} and
 * {@link AutosysDataSourceConfig} so the bean is excluded from the Spring context
 * during unit tests, keeping {@code ContextLoadsTest} live-Oracle-free.
 */
@Profile("!test")
@Configuration
@Slf4j
public class ReadonlyDataSourceConfig {

    @Value("${datasource.readonly.url}")
    private String url;

    @Value("${datasource.readonly.username}")
    private String username;

    /** Empty default so production (Citi VM) falls back to ScriptExecutor. */
    @Value("${datasource.readonly.password:}")
    private String password;

    @Value("${datasource.readonly.driver-class-name}")
    private String driverClassName;

    @Value("${datasource.readonly.service-name}")
    private String serviceName;

    @Value("${datasource.readonly.db-schema}")
    private String dbSchema;

    @Value("${datasource.readonly.hikari.maximum-pool-size:5}")
    private int maxPoolSize;

    @Value("${datasource.readonly.hikari.minimum-idle:1}")
    private int minIdle;

    @Value("${datasource.readonly.hikari.connection-timeout:20000}")
    private long connectionTimeout;

    @Bean(name = "readonlyDataSource")
    public DataSource readonlyDataSource() {
        // Phase 1 BOOT-08 dual-source closure mirrored from DataSourceConfig:
        // use ${datasource.readonly.password} when supplied (local profile),
        // else fall back to /opt/rectify/control/scripts/get_password.sh (Citi VM).
        String resolvedPassword;
        if (password != null && !password.isBlank()) {
            resolvedPassword = password;
        } else {
            ScriptExecutor scriptExecutor = new ScriptExecutor();
            resolvedPassword = scriptExecutor.executeScript(
                    "/opt/rectify/control/scripts/get_password.sh",
                    serviceName.toUpperCase(),
                    dbSchema.toUpperCase());
        }

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setUsername(username);
        config.setPassword(resolvedPassword);
        config.setDriverClassName(driverClassName);
        config.setMaximumPoolSize(maxPoolSize);
        config.setMinimumIdle(minIdle);
        config.setConnectionTimeout(connectionTimeout);
        config.setPoolName("Rectrace-Readonly-HikariCP");
        config.setReadOnly(true);

        // Oracle-specific optimisations (mirrors DataSourceConfig / AutosysDataSourceConfig).
        config.addDataSourceProperty("oracle.jdbc.ReadTimeout", "60000");
        config.addDataSourceProperty("oracle.net.CONNECT_TIMEOUT", "10000");

        log.info("Read-only DataSource initialized (pool={}, user={})", maxPoolSize, username);
        return new HikariDataSource(config);
    }

    /**
     * SQL-04: the singleton template is deliberately bare. Per-statement caps live in
     * SqlQueryServiceV4 via StatementCallback.
     */
    @Bean(name = "readonlyJdbcTemplate")
    public JdbcTemplate readonlyJdbcTemplate(@Qualifier("readonlyDataSource") DataSource ds) {
        return new JdbcTemplate(ds);
    }
}
