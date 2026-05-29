package com.citi.gru.rectrace.tlmstats.config;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;

import com.citi.gru.rectrace.tlmstats.model.TlmInstanceConfig;
import com.citi.gru.rectrace.tlmstats.model.TlmInstancesWrapper;
import com.citi.gru.rectrace.tlmstats.util.ScriptExecutor;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

/**
 * Database configuration for multiple TLM instances and reconmgmt database
 */
@Profile("!test")
@Configuration
public class DatabaseConfig {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseConfig.class);

    @Value("${reconmgmt.datasource.driver-class-name}")
    private String reconmgmtDriverClassName;

    @Value("${reconmgmt.datasource.url}")
    private String reconmgmtUrl;

    @Value("${reconmgmt.datasource.username}")
    private String reconmgmtUsername;

    @Value("${reconmgmt.datasource.service-name}")
    private String reconmgmtServiceName;

    @Value("${reconmgmt.datasource.db-schema}")
    private String reconmgmtDbSchema;

    @Value("${reconmgmt.datasource.password:}")
    private String reconmgmtPassword;

    @Value("${recportal.datasource.driver-class-name:oracle.jdbc.OracleDriver}")
    private String recportalDriverClassName;

    @Value("${recportal.datasource.url}")
    private String recportalUrl;

    @Value("${recportal.datasource.username}")
    private String recportalUsername;

    @Value("${recportal.datasource.service-name}")
    private String recportalServiceName;

    @Value("${recportal.datasource.db-schema}")
    private String recportalDbSchema;

    @Value("${recportal.datasource.password:}")
    private String recportalPassword;

    @Value("${password.script.path:/opt/rectify/control/scripts/get_password.sh}")
    private String passwordScriptPath;

    @Value("${reconmgmt.datasource.hikari.maximum-pool-size:5}")
    private int reconmgmtMaximumPoolSize;

    @Value("${reconmgmt.datasource.hikari.minimum-idle:2}")
    private int reconmgmtMinimumIdle;

    @Value("${reconmgmt.datasource.hikari.connection-timeout:30000}")
    private long reconmgmtConnectionTimeout;

    @Value("${reconmgmt.datasource.hikari.idle-timeout:600000}")
    private long reconmgmtIdleTimeout;

    @Value("${reconmgmt.datasource.hikari.max-lifetime:1800000}")
    private long reconmgmtMaxLifetime;

    @Value("${recportal.datasource.hikari.maximum-pool-size:5}")
    private int recportalMaximumPoolSize;

    @Value("${recportal.datasource.hikari.minimum-idle:2}")
    private int recportalMinimumIdle;

    @Value("${recportal.datasource.hikari.connection-timeout:30000}")
    private long recportalConnectionTimeout;

    @Value("${recportal.datasource.hikari.idle-timeout:600000}")
    private long recportalIdleTimeout;

    @Value("${recportal.datasource.hikari.max-lifetime:1800000}")
    private long recportalMaxLifetime;

    @Autowired
    private ScriptExecutor scriptExecutor;

    /**
     * Creates a DataSource for the reconmgmt database
     */
    @Bean(name = "reconmgmtDataSource")
    public DataSource reconmgmtDataSource() {
        logger.info("Creating reconmgmt DataSource for service: {} and schema: {}",
                   reconmgmtServiceName, reconmgmtDbSchema);

        // Phase 0.1 P07 KNOWN GAP closure (Phase 1 Wave 7): use ${reconmgmt.datasource.password}
        // when supplied (local profile via application-local.properties); fall back to
        // get_password.sh only on Citi VMs where the property is unset.
        String decryptedPassword;
        if (reconmgmtPassword != null && !reconmgmtPassword.isBlank()) {
            decryptedPassword = reconmgmtPassword;
        } else {
            decryptedPassword = scriptExecutor.executeScript(passwordScriptPath,
                    reconmgmtServiceName.toUpperCase(), reconmgmtDbSchema.toUpperCase());
        }

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(reconmgmtUrl);
        config.setUsername(reconmgmtUsername);
        config.setPassword(decryptedPassword);
        config.setDriverClassName(reconmgmtDriverClassName);
        config.setMaximumPoolSize(reconmgmtMaximumPoolSize);
        config.setMinimumIdle(reconmgmtMinimumIdle);
        config.setConnectionTimeout(reconmgmtConnectionTimeout);
        config.setIdleTimeout(reconmgmtIdleTimeout);
        config.setMaxLifetime(reconmgmtMaxLifetime);
        config.setPoolName("Reconmgmt-HikariCP");

        // Oracle specific optimizations
        config.addDataSourceProperty("oracle.jdbc.ReadTimeout", "60000");
        config.addDataSourceProperty("oracle.net.CONNECT_TIMEOUT", "10000");

        return new HikariDataSource(config);
    }

    /**
     * Creates a JdbcTemplate for the reconmgmt database
     */
    @Bean(name = "reconmgmtJdbcTemplate")
    public JdbcTemplate reconmgmtJdbcTemplate() {
        return new JdbcTemplate(reconmgmtDataSource());
    }

    /**
     * Creates a DataSource for the recportal database
     */
    @Bean(name = "recportalDataSource")
    public DataSource recportalDataSource() {
        logger.info("Creating recportal DataSource for service: {} and schema: {}",
                   recportalServiceName, recportalDbSchema);

        // Phase 0.1 P07 KNOWN GAP closure (Phase 1 Wave 7): use ${recportal.datasource.password}
        // when supplied (local profile via application-local.properties); fall back to
        // get_password.sh only on Citi VMs where the property is unset. Line ~234
        // (TlmJdbcTemplateFactory.getJdbcTemplate) is intentionally NOT wrapped here —
        // CONCERNS LOW #2 defers it to a later cleanup phase.
        String decryptedPassword;
        if (recportalPassword != null && !recportalPassword.isBlank()) {
            decryptedPassword = recportalPassword;
        } else {
            decryptedPassword = scriptExecutor.executeScript(passwordScriptPath,
                    recportalServiceName.toUpperCase(), recportalDbSchema.toUpperCase());
        }

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(recportalUrl);
        config.setUsername(recportalUsername);
        config.setPassword(decryptedPassword);
        config.setDriverClassName(recportalDriverClassName);
        config.setMaximumPoolSize(recportalMaximumPoolSize);
        config.setMinimumIdle(recportalMinimumIdle);
        config.setConnectionTimeout(recportalConnectionTimeout);
        config.setIdleTimeout(recportalIdleTimeout);
        config.setMaxLifetime(recportalMaxLifetime);
        config.setPoolName("Recportal-HikariCP");

        // Oracle specific optimizations
        config.addDataSourceProperty("oracle.jdbc.ReadTimeout", "60000");
        config.addDataSourceProperty("oracle.net.CONNECT_TIMEOUT", "10000");

        return new HikariDataSource(config);
    }

    /**
     * Creates a JdbcTemplate for the recportal database
     */
    @Bean(name = "recportalJdbcTemplate")
    public JdbcTemplate recportalJdbcTemplate() {
        return new JdbcTemplate(recportalDataSource());
    }

    /**
     * Loads TLM instance configurations from JSON file
     */
    @Bean(name = "tlmInstanceConfigurations")
    public Map<String, TlmInstanceConfig> loadTlmInstanceConfigurations() {
        Map<String, TlmInstanceConfig> configs = new HashMap<>();
        
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            ClassPathResource resource = new ClassPathResource("tlm-instances.json");
            
            try (InputStream inputStream = resource.getInputStream()) {
                TlmInstancesWrapper wrapper = objectMapper.readValue(inputStream, TlmInstancesWrapper.class);
                List<TlmInstanceConfig> instances = wrapper.getTlmInstances();
                
                for (TlmInstanceConfig config : instances) {
                    configs.put(config.getInstanceName(), config);
                    logger.info("Loaded TLM instance configuration: {}", config.getInstanceName());
                }
                
                logger.info("Successfully loaded {} TLM instance configurations", instances.size());
            }
            
        } catch (IOException e) {
            logger.error("Failed to load TLM instance configurations from JSON file", e);
            throw new RuntimeException("Failed to load TLM instance configurations", e);
        }
        
        return configs;
    }

    /**
     * Creates a factory for TLM JdbcTemplates
     */
    @Bean(name = "tlmJdbcTemplateFactory")
    public TlmJdbcTemplateFactory tlmJdbcTemplateFactory() {
        return new TlmJdbcTemplateFactory(loadTlmInstanceConfigurations());
    }

    /**
     * Factory class for creating TLM JdbcTemplates
     */
    public static class TlmJdbcTemplateFactory {
        private final Map<String, TlmInstanceConfig> configs;
        private final Map<String, JdbcTemplate> jdbcTemplates = new HashMap<>();
        private final ScriptExecutor scriptExecutor;
        private final String passwordScriptPath;

        public TlmJdbcTemplateFactory(Map<String, TlmInstanceConfig> configs) {
            this.configs = configs;
            this.scriptExecutor = new ScriptExecutor();
            this.passwordScriptPath = "/opt/rectify/control/scripts/get_password.sh";
        }

        public JdbcTemplate getJdbcTemplate(String tlmInstance) {
            if (!jdbcTemplates.containsKey(tlmInstance)) {
                TlmInstanceConfig config = configs.get(tlmInstance);
                if (config == null) {
                    throw new IllegalArgumentException("TLM instance not found: " + tlmInstance);
                }
                
                // Get password using script executor
                String decryptedPassword = scriptExecutor.executeScript(passwordScriptPath,
                        config.getServiceName().toUpperCase(), config.getDbSchema().toUpperCase());
                
                // Create DataSource
                DataSource dataSource = DataSourceBuilder
                        .create()
                        .url(config.buildJdbcUrl())
                        .username(config.getUsername())
                        .driverClassName("oracle.jdbc.OracleDriver")
                        .password(decryptedPassword)
                        .build();
                
                jdbcTemplates.put(tlmInstance, new JdbcTemplate(dataSource));
                logger.info("Created JdbcTemplate for TLM instance: {}", tlmInstance);
            }
            return jdbcTemplates.get(tlmInstance);
        }

        public boolean hasTlmInstance(String tlmInstance) {
            return configs.containsKey(tlmInstance);
        }
    }
} 