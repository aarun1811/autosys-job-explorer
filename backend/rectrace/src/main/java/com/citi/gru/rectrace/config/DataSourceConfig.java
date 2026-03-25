package com.citi.gru.rectrace.config;

import javax.sql.DataSource;
import javax.persistence.EntityManagerFactory;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import java.util.Properties;
import org.springframework.transaction.PlatformTransactionManager;
import com.citi.gru.rectrace.util.ScriptExecutor;

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
    @Primary
    public LocalContainerEntityMnagerFactoryBean entityManagerFactory() {
        LocalContainerEntityMnagerFactoryBean em = new LocalContainerEntityMnagerFactoryBean();
        em.setDataSource(dataSource());
        em.setPackagesToScan("com.citi.gru.rectrace"); // Scan for entities

        HibernateJpaVendorAdapter vendorAdapter = new HibernateJpaVendorAdapter();
        em.setJpaVendorAdapter(vendorAdapter);

        Properties properties = new Properties();
        properties.setProperty("hibernate.dialect", "org.hibernate.dialect.Oracle12cDialect");
        properties.setProperty("hibernate.show_sql", "true");
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