package com.citi.gru.rectrace.tlmstats.config;

import java.util.Arrays;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS configuration — explicit allow-list bound from {@code app.cors.allowed-origins}.
 *
 * <p>Replaces the previous {@code allowedOriginPatterns("*")} + {@code allowCredentials(true)}
 * combination which was a CORS-spec violation and a CSRF escalation vector (CONCERNS.md
 * CRITICAL). {@code allowCredentials(true)} is dropped — this service authenticates via
 * the custom {@code x-citiportal-loginid} header, not cookies or {@code Authorization}.
 */
@Configuration
public class CorsConfig {

    private static final Logger log = LoggerFactory.getLogger(CorsConfig.class);

    @Value("${app.cors.allowed-origins:}")
    private String allowedOriginsCsv;

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        String[] origins = parseOrigins(allowedOriginsCsv);
        if (origins.length == 0) {
            log.warn("app.cors.allowed-origins is empty — all cross-origin requests will be rejected. "
                + "Set the property in the active profile to opt in.");
        } else {
            log.info("CORS allowed origins: {}", Arrays.toString(origins));
        }

        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                        .allowedOrigins(origins)
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD")
                        .allowedHeaders("*")
                        .maxAge(3600);
            }
        };
    }

    private static String[] parseOrigins(String csv) {
        if (csv == null || csv.isEmpty()) {
            return new String[0];
        }
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);
    }
}
