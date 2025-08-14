package com.citi.gru.rectrace.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;

@Configuration
public class AutosysDataSourceConfig {

    @Value("${autosys.db.url}")
    private String url;

    @Value("${autosys.db.username}")
    private String username;

    @Value("${autosys.db.password}")
    private String password;

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
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setUsername(username);
        config.setPassword(password);
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