package com.citi.gru.autosysjobexplorer.config;

import com.citi.gru.autosysjobexplorer.util.ScriptExecutor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

@Configuration
public class DataSourceConfig {

    @Value("${datasource.driver-class-name}")
    private String driverClassName;

    @Value("${datasource.url}")
    private String jdbcUrl;

    @Value("${datasource.username}")
    private String username;

    @Value("${datasource.service-name}")
    private String serviceName;

    @Value("${datasource.db-schema}")
    private String dbschema;

    @Bean
    public DataSource dataSource() {
        ScriptExecutor scriptExecutor = new ScriptExecutor();
        String decryptedPassword = scriptExecutor.executeScript("/opt/rectify/control/scripts/get_password.sh",
                serviceName.toUpperCase(), dbschema.toUpperCase());
        return DataSourceBuilder
                .create()
                .url(jdbcUrl)
                .username(username)
                .driverClassName(driverClassName)
                .password(decryptedPassword)
                .build();
    }
}
