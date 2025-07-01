package com.citi.gru.rectrace.service;

import java.io.InputStream; // Ensure all DTOs are imported
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import javax.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import com.citi.gru.rectrace.dto.ElasticsearchProviderConfig;
import com.citi.gru.rectrace.dto.OracleProviderConfig;
import com.citi.gru.rectrace.dto.ProviderSpecificConfig;
import com.citi.gru.rectrace.dto.SearchCategoryDefinition;
import com.citi.gru.rectrace.dto.SearchColumnDefinition;
import com.citi.gru.rectrace.dto.SearchConfiguration;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class SearchConfigService {

    private static final Logger logger = LoggerFactory.getLogger(SearchConfigService.class);
    private static final String CONFIG_FILE = "search-config.json";
    // Define allowed provider types for validation
    private static final Set<String> ALLOWED_PROVIDER_TYPES = Collections.unmodifiableSet(
        new HashSet<>(Arrays.asList("oracle", "elasticsearch")));

    private final ObjectMapper objectMapper;
    private List<SearchCategoryDefinition> searchCategories = Collections.emptyList();

    @Autowired
    public SearchConfigService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    private void loadAndValidateConfig() {
        try {
            logger.info("Loading search configuration from {}", CONFIG_FILE);
            ClassPathResource resource = new ClassPathResource(CONFIG_FILE);
            if (!resource.exists()) {
                logger.error("Search configuration file not found at classpath:{}", CONFIG_FILE);
                this.searchCategories = Collections.emptyList();
                return;
            }

            try (InputStream inputStream = resource.getInputStream()) {
                SearchConfiguration configWrapper = objectMapper.readValue(inputStream, SearchConfiguration.class); // Load into wrapper DTO
                
                if (configWrapper != null && configWrapper.getSearchCategories() != null) {
                    // Use the list from the wrapper DTO
                    this.searchCategories = configWrapper.getSearchCategories();
                    validateCategories(); // Validate the loaded definitions
                    logger.info("Successfully loaded and validated {} search categories.", 
                        getValidSearchCategories().size());
                } else {
                    logger.warn("Search configuration file {} is empty or invalid.", CONFIG_FILE);
                    this.searchCategories = Collections.emptyList();
                }
            }
        } catch (Exception e) {
            logger.error("Failed to load or parse search configuration file: {}", CONFIG_FILE, e);
            this.searchCategories = Collections.emptyList(); // Ensure list is empty on error
        }
    }

    /**
     * Validates the loaded search category definitions.
     * Sets an internal 'valid' flag on each definition.
     */
    private void validateCategories() {
        if (CollectionUtils.isEmpty(this.searchCategories)) return;

        for (SearchCategoryDefinition category : this.searchCategories) {
            boolean categoryValid = true;

            // 1. Validate Common Fields
            if (!StringUtils.hasText(category.getKey())) {
                logger.warn("Validation failed: Missing 'key' for a category.");
                categoryValid = false;
            }
            String categoryKey = StringUtils.hasText(category.getKey()) ? category.getKey() : "[Unknown Category]";

            if (!StringUtils.hasText(category.getLabel())) {
                logger.warn("Validation failed for category '{}': Missing 'label'", categoryKey);
                categoryValid = false;
            }
            if (CollectionUtils.isEmpty(category.getColumns())) {
                logger.warn("Validation failed for category '{}': Missing or empty 'columns'", categoryKey);
                categoryValid = false;
            } else {
                // Check if column fields/headers are defined
                for (int i = 0; i < category.getColumns().size(); i++) {
                    SearchColumnDefinition col = category.getColumns().get(i);
                    if (!StringUtils.hasText(col.getField())) {
                        logger.warn("Validation failed for category '{}', column index {}: Missing 'field'", categoryKey, i);
                        categoryValid = false;
                    }
                    if (!StringUtils.hasText(col.getHeaderName())) {
                        logger.warn("Validation failed for category '{}', column index {}: Missing 'headerName'", categoryKey, i);
                        categoryValid = false;
                    }
                }
            }

            // 2. Validate Search Provider Type
            String providerType = category.getSearchProviderType();
            if (!StringUtils.hasText(providerType)) {
                logger.warn("Validation failed for category '{}': Missing 'searchProviderType'", categoryKey);
                categoryValid = false;
            } else if (!ALLOWED_PROVIDER_TYPES.contains(providerType.toLowerCase())) {
                logger.warn("Validation failed for category '{}': Invalid 'searchProviderType' specified: '{}'. Allowed types are: {}",
                        categoryKey, providerType, ALLOWED_PROVIDER_TYPES);
                categoryValid = false;
            }

            // 3. Validate Provider-Specific Config based on Type
            ProviderSpecificConfig providerConfig = category.getProviderConfig();
            if (providerConfig == null) {
                // This might be okay if searchProviderType itself was invalid, already flagged above
                 if (StringUtils.hasText(providerType) && ALLOWED_PROVIDER_TYPES.contains(providerType.toLowerCase())) {
                     logger.warn("Validation failed for category '{}': Missing 'providerConfig' block for specified type '{}'", categoryKey, providerType);
                     categoryValid = false;
                 }
            } else {
                // Perform validation specific to the identified provider type
                if ("oracle".equalsIgnoreCase(providerType)) {
                    if (!(providerConfig instanceof OracleProviderConfig)) {
                        logger.warn("Validation failed for category '{}': 'searchProviderType' is 'oracle' but 'providerConfig' is not of type OracleProviderConfig (Actual: {})", categoryKey, providerConfig.getClass().getSimpleName());
                        categoryValid = false;
                    } else {
                        OracleProviderConfig oraConfig = (OracleProviderConfig) providerConfig;
                        if (!StringUtils.hasText(oraConfig.getQuery())) {
                            logger.warn("Validation failed for Oracle category '{}': Missing 'query' in providerConfig", categoryKey);
                            categoryValid = false;
                        }
                        if (!StringUtils.hasText(oraConfig.getParameterName())) {
                            logger.warn("Validation failed for Oracle category '{}': Missing 'parameterName' in providerConfig", categoryKey);
                            categoryValid = false;
                        } else if (StringUtils.hasText(oraConfig.getQuery()) && !oraConfig.getQuery().contains(":" + oraConfig.getParameterName())) {
                            logger.warn("Validation failed for Oracle category '{}': Query does not seem to contain the specified parameterName ':{}'", categoryKey, oraConfig.getParameterName());
                             categoryValid = false; // Parameter must exist in query for Oracle provider
                        }
                    }
                } else if ("elasticsearch".equalsIgnoreCase(providerType)) {
                    if (!(providerConfig instanceof ElasticsearchProviderConfig)) {
                         logger.warn("Validation failed for category '{}': 'searchProviderType' is 'elasticsearch' but 'providerConfig' is not of type ElasticsearchProviderConfig (Actual: {})", categoryKey, providerConfig.getClass().getSimpleName());
                        categoryValid = false;
                    } else {
                        ElasticsearchProviderConfig esConfig = (ElasticsearchProviderConfig) providerConfig;
                        if (!StringUtils.hasText(esConfig.getTargetIndex())) {
                            logger.warn("Validation failed for Elasticsearch category '{}': Missing 'targetIndex' in providerConfig", categoryKey);
                            categoryValid = false;
                        }
                        if (CollectionUtils.isEmpty(esConfig.getQueryFields())) {
                            logger.warn("Validation failed for Elasticsearch category '{}': Missing or empty 'queryFields' in providerConfig", categoryKey);
                            categoryValid = false;
                        }
                        // Add more specific validations for ES config if needed (e.g., sort direction)
                        if (esConfig.getDefaultSort() != null && StringUtils.hasText(esConfig.getDefaultSort().getDirection()) &&
                            !Set.of("asc", "desc").contains(esConfig.getDefaultSort().getDirection().toLowerCase())) {
                                logger.warn("Validation failed for Elasticsearch category '{}': Invalid 'direction' in defaultSort. Must be 'asc' or 'desc'.", categoryKey);
                                categoryValid = false;
                        }
                    }
                }
                // Add validation for other provider types here if needed in the future
            }

            // Set the final validity flag on the DTO
            category.setValid(categoryValid);
        }
    }

    /**
     * Returns the list of search category definitions that passed validation.
     *
     * @return A list of valid SearchCategoryDefinition objects.
     */
    public List<SearchCategoryDefinition> getValidSearchCategories() {
        if (this.searchCategories == null) {
            return Collections.emptyList();
        }
        return this.searchCategories.stream()
                .filter(SearchCategoryDefinition::isValid) // Use the internal validity flag
                .collect(Collectors.toList());
    }

     /**
     * Returns the full list of SearchCategoryDefinition objects, including invalid ones.
     */
     public List<SearchCategoryDefinition> getAllSearchCategories() {
         return Collections.unmodifiableList(this.searchCategories != null ? this.searchCategories : Collections.emptyList());
     }
}