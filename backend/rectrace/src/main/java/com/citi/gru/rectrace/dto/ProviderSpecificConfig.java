package com.citi.gru.rectrace.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Base abstract class for provider-specific search configurations.
 * Subclasses will hold configurations for Oracle, Elasticsearch, etc.
 */
@JsonInclude(JsonInclude.Include.NON_NULL) // Good practice for subclasses
public abstract class ProviderSpecificConfig {
    // Base class can be empty or hold common fields if identified later
}