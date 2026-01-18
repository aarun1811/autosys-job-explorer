package com.citi.gru.rectrace.service;

import java.io.InputStream;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import javax.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import com.citi.gru.rectrace.dto.ElasticsearchProviderConfig;
import com.citi.gru.rectrace.dto.OracleProviderConfig;
import com.citi.gru.rectrace.dto.SearchCategoryDefinition;
import com.citi.gru.rectrace.dto.SearchConfiguration;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class SearchConfigServiceV3 {

    private static final Logger logger = LoggerFactory.getLogger(SearchConfigServiceV3.class);
    @Value("${search-config.location-old}")
    private String CONFIG_FILE;

    private final ObjectMapper objectMapper;

    private final ResourceLoader resourceLoader;
    private List<SearchCategoryDefinition> searchCategories = Collections.emptyList();

    @Autowired
    public SearchConfigServiceV3(ObjectMapper objectMapper, ResourceLoader resourceLoader) {
        this.objectMapper = objectMapper;
        this.resourceLoader = resourceLoader;
    }

    @PostConstruct
    private void loadAndValidateConfig() {
        try {
            logger.info("Loading search configuration from {}", CONFIG_FILE);
            Resource resource = this.resourceLoader.getResource(CONFIG_FILE);
            if (!resource.exists()) {
                logger.error("Search configuration file not found at classpath:{}", CONFIG_FILE);
                this.searchCategories = Collections.emptyList();
                return;
            }

            try (InputStream inputStream = resource.getInputStream()) {
                SearchConfiguration configWrapper = objectMapper.readValue(inputStream, SearchConfiguration.class);
                
                if (configWrapper != null && configWrapper.getSearchCategories() != null) {
                    this.searchCategories = configWrapper.getSearchCategories();
                    validateCategories();
                    logger.info("Successfully loaded and validated {} search categories.", 
                        getValidSearchCategories().size());
                } else {
                    logger.warn("Search configuration file {} is empty or invalid.", CONFIG_FILE);
                    this.searchCategories = Collections.emptyList();
                }
            }
        } catch (Exception e) {
            logger.error("Failed to load or parse search configuration file: {}", CONFIG_FILE, e);
            this.searchCategories = Collections.emptyList();
        }
    }

/**
 * Get ES configuration for keyword search only
 * Returns only essential fields needed for initial search
 */
public ElasticsearchProviderConfig getKeywordSearchConfig(String categoryKey) {
    if (!StringUtils.hasText(categoryKey)) {
        logger.warn("Category key is null or empty");
        return null;
    }

    Optional<SearchCategoryDefinition> category = searchCategories.stream()
            .filter(cat -> categoryKey.equals(cat.getKey()) && cat.isValid())
            .findFirst();

    if (!category.isPresent()) {
        logger.warn("Category '{}' not found or not valid", categoryKey);
        return null;
    }

    SearchCategoryDefinition categoryDef = category.get();

    // Check if it's configured for ES
    if (!"elasticsearch".equalsIgnoreCase(categoryDef.getSearchProviderType())) {
        logger.warn("Category '{}' is not configured for Elasticsearch", categoryKey);
        return null;
    }

    if (!(categoryDef.getProviderConfig() instanceof ElasticsearchProviderConfig)) {
        logger.warn("Category '{}' does not have valid Elasticsearch configuration", categoryKey);
        return null;
    }

    ElasticsearchProviderConfig esConfig = (ElasticsearchProviderConfig) categoryDef.getProviderConfig();

    // Validate essential fields
    if (!StringUtils.hasText(esConfig.getTargetIndex())) {
        logger.warn("Category '{}' missing targetIndex in ES config", categoryKey);
        return null;
    }

    if (CollectionUtils.isEmpty(esConfig.getQueryFields())) {
        logger.warn("Category '{}' missing queryFields in ES config", categoryKey);
        return null;
    }

    logger.debug("Retrieved ES config for category '{}': index={}, queryFields={}",
            categoryKey, esConfig.getTargetIndex(), esConfig.getQueryFields());

    return esConfig;
}

/**
 * Get Oracle configuration for group expansion
 */
public OracleProviderConfig getGroupExpansionConfig(String categoryKey) {
    if (!StringUtils.hasText(categoryKey)) {
        logger.warn("Category key is null or empty");
        return null;
    }

    Optional<SearchCategoryDefinition> category = searchCategories.stream()
            .filter(cat -> categoryKey.equals(cat.getKey()) && cat.isValid())
            .findFirst();

    if (!category.isPresent()) {
        logger.warn("Category '{}' not found or not valid", categoryKey);
        return null;
    }

    SearchCategoryDefinition categoryDef = category.get();

    // First, check if there's a dedicated oracleConfig field
    if (categoryDef.getOracleConfig() != null) {
        OracleProviderConfig oracleConfig = categoryDef.getOracleConfig();

        // Validate essential fields
        if (!StringUtils.hasText(oracleConfig.getQuery())) {
            logger.warn("Category '{}' missing query in Oracle config", categoryKey);
            return null;
        }

        logger.debug("Retrieved Oracle config for category '{}': query={} ", categoryKey, oracleConfig.getQuery());
        return oracleConfig;
    }



    // For now, we'll use the existing Oracle config if available
    // In the future, we can add specific oracleConfig field
    if (categoryDef.getProviderConfig() instanceof OracleProviderConfig) {
        OracleProviderConfig oracleConfig = (OracleProviderConfig) categoryDef.getProviderConfig();

        // Validate essential fields
        if (!StringUtils.hasText(oracleConfig.getQuery())) {
            logger.warn("Category '{}' missing query in Oracle config", categoryKey);
            return null;
        }

        if (!StringUtils.hasText(oracleConfig.getParameterName())) {
            logger.warn("Category '{}' missing parameterName in Oracle config", categoryKey);
            return null;
        }

        logger.debug("Retrieved Oracle config for category '{}': query={}, parameterName={}",
                categoryKey, oracleConfig.getQuery(), oracleConfig.getParameterName());

        return oracleConfig;
    }

    // If no Oracle config exists, we'll need to create a default one based on the category
    logger.info("No Oracle config found for category '{}', will create default config", categoryKey);
    return createDefaultOracleConfig(categoryDef);
}

/**
 * Create default Oracle config based on category definition
 */
private OracleProviderConfig createDefaultOracleConfig(SearchCategoryDefinition categoryDef) {
    OracleProviderConfig defaultConfig = new OracleProviderConfig();

    // Get the first column as the group column
    if (!CollectionUtils.isEmpty(categoryDef.getColumns())) {
        String groupColumn = categoryDef.getColumns().get(0).getField();

        // Create a simple query for group expansion
        String query = String.format("SELECT * FROM autosys_jobs WHERE %s = :groupKey", groupColumn);
        defaultConfig.setQuery(query);
        defaultConfig.setParameterName("groupKey");

        logger.debug("Created default Oracle config for category '{}': query={}",
                categoryDef.getKey(), query);

        return defaultConfig;
    }

    logger.warn("Cannot create default Oracle config for category '{}': no columns defined",
            categoryDef.getKey());
    return null;
}

/**
 * Get category definition by key
 */
public SearchCategoryDefinition getCategoryDefinition(String categoryKey) {
    if (!StringUtils.hasText(categoryKey)) {
        return null;
    }

    return searchCategories.stream()
            .filter(cat -> categoryKey.equals(cat.getKey()) && cat.isValid())
            .findFirst()
            .orElse(null);
}

    /**
     * Returns the list of search category definitions that passed validation.
     */
    public List<SearchCategoryDefinition> getValidSearchCategories() {
        if (this.searchCategories == null) {
            return Collections.emptyList();
        }
        return this.searchCategories.stream()
                .filter(SearchCategoryDefinition::isValid)
                .collect(java.util.stream.Collectors.toList());
    }

    /**
     * Validate the loaded search category definitions.
     */
    private void validateCategories() {
        if (CollectionUtils.isEmpty(this.searchCategories)) return;

        for (SearchCategoryDefinition category : this.searchCategories) {
            boolean categoryValid = true;
            String categoryKey = StringUtils.hasText(category.getKey()) ? category.getKey() : "[Unknown Category]";

            // Validate common fields
            if (!StringUtils.hasText(category.getKey())) {
                logger.warn("Validation failed: Missing 'key' for a category.");
                categoryValid = false;
            }

            if (!StringUtils.hasText(category.getLabel())) {
                logger.warn("Validation failed for category '{}': Missing 'label'", categoryKey);
                categoryValid = false;
            }

            if (CollectionUtils.isEmpty(category.getColumns())) {
                logger.warn("Validation failed for category '{}': Missing or empty 'columns'", categoryKey);
                categoryValid = false;
            }

            // Validate provider type
            String providerType = category.getSearchProviderType();
            if (!StringUtils.hasText(providerType)) {
                logger.warn("Validation failed for category '{}': Missing 'searchProviderType'", categoryKey);
                categoryValid = false;
            } else if (!"elasticsearch".equalsIgnoreCase(providerType) && !"oracle".equalsIgnoreCase(providerType)) {
                logger.warn("Validation failed for category '{}': Invalid 'searchProviderType': '{}'",
                        categoryKey, providerType);
                categoryValid = false;
            }

            // Set the final validity flag
            category.setValid(categoryValid);
        }
    }
}
