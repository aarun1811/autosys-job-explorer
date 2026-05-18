package com.citi.gru.rectrace.config;

import java.util.Arrays;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS configuration — explicit allow-list bound from {@code app.cors.allowed-origins}
 * (comma-separated). Replaces the previous {@code allowedOrigins("*")} which was flagged
 * CRITICAL in {@code .planning/codebase/CONCERNS.md}.
 *
 * <p>When the property is empty (default), CORS is effectively disabled — cross-origin
 * requests are rejected. Each environment must opt in explicitly:
 * <ul>
 *   <li>{@code application-local.properties} ships dev defaults (localhost:4200/5173/6088)</li>
 *   <li>{@code application-prod.properties} / {@code application-uat.properties} carry a
 *       {@code [NEEDS USER REVIEW]} placeholder for the Citi portal origin(s)</li>
 * </ul>
 *
 * <p>{@code allowCredentials(true)} is deliberately omitted: the app authenticates via the
 * custom {@code x-citiportal-loginid} header, not cookies or {@code Authorization}, so
 * credentialed CORS is not required.
 */
@Configuration
@Slf4j
public class CorsConfig {

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
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*");
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
