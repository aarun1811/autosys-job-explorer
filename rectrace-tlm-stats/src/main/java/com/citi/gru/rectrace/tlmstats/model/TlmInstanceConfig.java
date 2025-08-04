package com.citi.gru.rectrace.tlmstats.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Model class for TLM instance configuration from JSON file
 */
public class TlmInstanceConfig {

    @JsonProperty("instanceName")
    private String instanceName;

    @JsonProperty("host")
    private String host;

    @JsonProperty("port")
    private String port;

    @JsonProperty("serviceName")
    private String serviceName;

    @JsonProperty("username")
    private String username;

    @JsonProperty("dbSchema")
    private String dbSchema;

    // Default constructor
    public TlmInstanceConfig() {}

    // Constructor with all fields
    public TlmInstanceConfig(String instanceName, String host, String port, 
                           String serviceName, String username, String dbSchema) {
        this.instanceName = instanceName;
        this.host = host;
        this.port = port;
        this.serviceName = serviceName;
        this.username = username;
        this.dbSchema = dbSchema;
    }

    // Getters and Setters
    public String getInstanceName() {
        return instanceName;
    }

    public void setInstanceName(String instanceName) {
        this.instanceName = instanceName;
    }

    public String getHost() {
        return host;
    }

    public void setHost(String host) {
        this.host = host;
    }

    public String getPort() {
        return port;
    }

    public void setPort(String port) {
        this.port = port;
    }

    public String getServiceName() {
        return serviceName;
    }

    public void setServiceName(String serviceName) {
        this.serviceName = serviceName;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getDbSchema() {
        return dbSchema;
    }

    public void setDbSchema(String dbSchema) {
        this.dbSchema = dbSchema;
    }

    /**
     * Builds the JDBC URL for this TLM instance
     */
    public String buildJdbcUrl() {
        return "jdbc:oracle:thin:@//" + host + ":" + port + "/" + serviceName;
    }

    @Override
    public String toString() {
        return "TlmInstanceConfig{" +
                "instanceName='" + instanceName + '\'' +
                ", host='" + host + '\'' +
                ", port='" + port + '\'' +
                ", serviceName='" + serviceName + '\'' +
                ", username='" + username + '\'' +
                ", dbSchema='" + dbSchema + '\'' +
                '}';
    }
} 