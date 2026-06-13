package com.citi.gru.rectrace.config;

import com.citi.gru.rectrace.util.ScriptExecutor;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;

@Profile("!test")
@Configuration
public class AutosysDataSourceConfig {

    @Value("${autosys.db.url}")
    private String url;

    @Value("${autosys.db.username}")
    private String username;

    /**
     * Empty default so production falls back to {@code get_password.sh} when blank —
     * mirrors {@link DataSourceConfig} / {@link ReadonlyDataSourceConfig}. A directly
     * configured value (e.g. application-prod.properties) is used verbatim.
     */
    @Value("${autosys.db.password:}")
    private String password;

    /** Used only for the script fallback (when the password above is blank). */
    @Value("${autosys.db.service-name:}")
    private String serviceName;

    /** Used only for the script fallback (when the password above is blank). */
    @Value("${autosys.db.schema:}")
    private String dbSchema;

    @Value("${autosys.db.driver-class-name}")
    private String driverClassName;

    @Value("${autosys.db.hikari.maximum-pool-size:5}")
    private int maximumPoolSize;

    @Value("${autosys.db.hikari.minimum-idle:2}")
    private int minimumIdle;

    @Value("${autosys.db.hikari.connection-timeout:30000}")
    private long connectionTimeout;

    @Value("${autosys.db.hikari.idle-timeout:600000}")
    private long idleTimeout;

    @Value("${autosys.db.hikari.max-lifetime:1800000}")
    private long maxLifetime;

    @Bean(name = "autosysDataSource")
    public DataSource autosysDataSource() {
        // Use the configured password when supplied (e.g. application-prod.properties),
        // else fall back to /opt/rectify/control/scripts/get_password.sh keyed on
        // (service-name, db-schema) — mirrors DataSourceConfig / ReadonlyDataSourceConfig.
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
        config.setMaximumPoolSize(maximumPoolSize);
        config.setMinimumIdle(minimumIdle);
        config.setConnectionTimeout(connectionTimeout);
        config.setIdleTimeout(idleTimeout);
        config.setMaxLifetime(maxLifetime);
        config.setPoolName("AutoSys-HikariCP");
        
        // Oracle specific optimizations
        config.addDataSourceProperty("oracle.jdbc.ReadTimeout", "60000");
        config.addDataSourceProperty("oracle.net.CONNECT_TIMEOUT", "10000");
        
        return new HikariDataSource(config);
    }
}