package com.citi.gru.rectrace.config;

import javax.sql.DataSource;
import jakarta.persistence.EntityManagerFactory;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import java.util.Properties;
import org.springframework.transaction.PlatformTransactionManager;

import com.citi.gru.rectrace.util.ScriptExecutor;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

@Profile("!test")
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

    @Value("${datasource.hikari.maximum-pool-size:5}")
    private int maximumPoolSize;

    @Value("${datasource.hikari.minimum-idle:2}")
    private int minimumIdle;

    @Value("${datasource.hikari.connection-timeout:30000}")
    private long connectionTimeout;

    @Value("${datasource.hikari.idle-timeout:600000}")
    private long idleTimeout;

    @Value("${datasource.hikari.max-lifetime:1800000}")
    private long maxLifetime;

    @Bean
    @Primary
    public DataSource dataSource() {
        ScriptExecutor scriptExecutor = new ScriptExecutor();
        String decryptedPassword = scriptExecutor.executeScript("/opt/rectify/control/scripts/get_password.sh",
                serviceName.toUpperCase(), dbschema.toUpperCase());

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(jdbcUrl);
        config.setUsername(username);
        config.setPassword(decryptedPassword);
        config.setDriverClassName(driverClassName);
        config.setMaximumPoolSize(maximumPoolSize);
        config.setMinimumIdle(minimumIdle);
        config.setConnectionTimeout(connectionTimeout);
        config.setIdleTimeout(idleTimeout);
        config.setMaxLifetime(maxLifetime);
        config.setPoolName("Rectrace-HikariCP");

        // Oracle specific optimizations
        config.addDataSourceProperty("oracle.jdbc.ReadTimeout", "60000");
        config.addDataSourceProperty("oracle.net.CONNECT_TIMEOUT", "10000");

        return new HikariDataSource(config);
    }

    @Bean
    @Primary
    public LocalContainerEntityManagerFactoryBean entityManagerFactory() {
        LocalContainerEntityManagerFactoryBean em = new LocalContainerEntityManagerFactoryBean();
        em.setDataSource(dataSource());
        em.setPackagesToScan("com.citi.gru.rectrace"); // Scan for entities

        HibernateJpaVendorAdapter vendorAdapter = new HibernateJpaVendorAdapter();
        em.setJpaVendorAdapter(vendorAdapter);

        Properties properties = new Properties();
        properties.setProperty("hibernate.hbm2ddl.auto", "none");
        em.setJpaProperties(properties);

        return em;
    }

    @Bean
    @Primary
    public PlatformTransactionManager transactionManager(EntityManagerFactory entityManagerFactory) {
        JpaTransactionManager transactionManager = new JpaTransactionManager();
        transactionManager.setEntityManagerFactory(entityManagerFactory);
        return transactionManager;
    }
}
