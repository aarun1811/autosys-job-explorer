package com.citi.gru.rectrace.service.v4;

import com.citi.gru.rectrace.dto.v4.CategoryConfigV4;
import com.citi.gru.rectrace.dto.v4.SearchConfigurationV4;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class SearchConfigServiceV4 {

    @Value("${search-config.location}")
    private String CONFIG_FILE;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ResourceLoader resourceLoader;

    private SearchConfigurationV4 configuration;
    private Map<String, CategoryConfigV4> categoryMap;

    @PostConstruct
    public void loadConfiguration() {
        try {
            log.info("Loading search configuration from: {}", CONFIG_FILE);

            Resource resource = this.resourceLoader.getResource(CONFIG_FILE);
            try (InputStream inputStream = resource.getInputStream()) {
                configuration = objectMapper.readValue(inputStream, SearchConfigurationV4.class);
            }

            // Build category map for quick lookup
            categoryMap = new HashMap<>();
            if (configuration != null && configuration.getCategories() != null) {
                for (CategoryConfigV4 category : configuration.getCategories()) {
                    categoryMap.put(category.getKey(), category);
                }
            }

            log.info("Successfully loaded {} search categories", categoryMap.size());

        } catch (Exception e) {
            log.error("Failed to load search configuration", e);
            throw new RuntimeException("Failed to load search configuration", e);
        }
    }

    public SearchConfigurationV4 getConfiguration() {
        return configuration;
    }

    public List<CategoryConfigV4> getCategories() {
        return configuration.getCategories();
    }

    public CategoryConfigV4 getCategoryConfig(String categoryKey) {
        CategoryConfigV4 config = categoryMap.get(categoryKey);
        if (config == null) {
            throw new IllegalArgumentException("Invalid category: " + categoryKey);
        }
        return config;
    }

    public boolean isValidCategory(String categoryKey) {
        return categoryMap.containsKey(categoryKey);
    }
}