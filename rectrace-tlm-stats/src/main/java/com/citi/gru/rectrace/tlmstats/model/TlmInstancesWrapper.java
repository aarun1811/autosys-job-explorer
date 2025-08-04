package com.citi.gru.rectrace.tlmstats.model;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Wrapper class for TLM instances configuration from JSON file
 */
public class TlmInstancesWrapper {

    @JsonProperty("tlmInstances")
    private List<TlmInstanceConfig> tlmInstances;

    // Default constructor
    public TlmInstancesWrapper() {}

    // Constructor with tlmInstances
    public TlmInstancesWrapper(List<TlmInstanceConfig> tlmInstances) {
        this.tlmInstances = tlmInstances;
    }

    // Getters and Setters
    public List<TlmInstanceConfig> getTlmInstances() {
        return tlmInstances;
    }

    public void setTlmInstances(List<TlmInstanceConfig> tlmInstances) {
        this.tlmInstances = tlmInstances;
    }

    @Override
    public String toString() {
        return "TlmInstancesWrapper{" +
                "tlmInstances=" + tlmInstances +
                '}';
    }
} 