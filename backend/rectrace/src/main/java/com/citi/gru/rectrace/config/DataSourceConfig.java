package com.citi.gru.rectrace.config;

import javax.persistence.EntityManagerFactory;
import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.boot.orm.jpa.EntityManagerFactoryBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import com.citi.gru.rectrace.util.ScriptExecutor;

@Configuration
@EnableTransactionManagement
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

    // Autosys database properties
    @Value("${autosys.datasource.driver-class-name:oracle.jdbc.OracleDriver}")
    private String autosysDriverClassName;

    @Value("${autosys.datasource.url}")
    private String autosysJdbcUrl;

    @Value("${autosys.datasource.username}")
    private String autosysUsername;

    @Value("${autosys.datasource.service-name}")
    private String autosysServiceName;

    @Value("${autosys.datasource.db-schema}")
    private String autosysDbschema;

    @Bean
    @Primary
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

    @Bean
    @Qualifier("autosysDataSource")
    public DataSource autosysDataSource() {
        ScriptExecutor scriptExecutor = new ScriptExecutor();
        String decryptedPassword = scriptExecutor.executeScript("/opt/rectify/control/scripts/get_password.sh",
                autosysServiceName.toUpperCase(), autosysDbschema.toUpperCase());
        return DataSourceBuilder
                .create()
                .url(autosysJdbcUrl)
                .username(autosysUsername)
                .driverClassName(autosysDriverClassName)
                .password(decryptedPassword)
                .build();
    }

    @Bean
    @Primary
    public LocalContainerEntityManagerFactoryBean entityManagerFactory(
            EntityManagerFactoryBuilder builder,
            @Qualifier("dataSource") DataSource dataSource) {
        return builder
                .dataSource(dataSource)
                .packages("com.citi.gru.rectrace")
                .persistenceUnit("primary")
                .build();
    }

    @Bean
    @Qualifier("autosysEntityManagerFactory")
    public LocalContainerEntityManagerFactoryBean autosysEntityManagerFactory(
            EntityManagerFactoryBuilder builder,
            @Qualifier("autosysDataSource") DataSource autosysDataSource) {
        return builder
                .dataSource(autosysDataSource)
                .packages("com.citi.gru.rectrace")
                .persistenceUnit("autosys")
                .build();
    }

    @Bean
    @Primary
    public PlatformTransactionManager transactionManager(
            @Qualifier("entityManagerFactory") EntityManagerFactory entityManagerFactory) {
        return new JpaTransactionManager(entityManagerFactory);
    }

    @Bean
    @Qualifier("autosysTransactionManager")
    public PlatformTransactionManager autosysTransactionManager(
            @Qualifier("autosysEntityManagerFactory") EntityManagerFactory autosysEntityManagerFactory) {
        return new JpaTransactionManager(autosysEntityManagerFactory);
    }
}
