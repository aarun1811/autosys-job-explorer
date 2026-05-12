package com.citi.gru.rectrace.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Permit-all SecurityFilterChain bootstrap for Phase 1 (BOOT-04, D-1.8).
 *
 * <p>The bean intentionally permits all requests and disables CSRF: this module
 * is a REST API consumed by the Angular V5 frontend, and authentication is
 * deferred to Phase 9 (D-1.9, T-1-SEC-01). The explicit bean is required to
 * defeat Spring Security's auto-generated user/password fallback that would
 * otherwise activate as soon as {@code spring-boot-starter-security} lands on
 * the classpath (T-1-SEC-04).
 *
 * <p>The {@code @Profile("!test")} guard preserves Phase 0's context-load test
 * contract (D-1.17): the test profile already excludes infrastructure auto-
 * configs via {@code spring.autoconfigure.exclude}, and skipping this bean
 * keeps the filter-chain off the test boot path entirely.
 *
 * <p>Existing {@code x-citiportal-loginid} header semantics are preserved
 * unchanged at the controller layer — this chain does not inspect or validate
 * the header. Phase 9 SEC-01 owns that work.
 */
@Profile("!test")
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(authz -> authz.anyRequest().permitAll());
        return http.build();
    }
}
