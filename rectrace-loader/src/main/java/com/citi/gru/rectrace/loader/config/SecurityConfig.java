package com.citi.gru.rectrace.loader.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Permit-all SecurityFilterChain bootstrap for the loader module (Phase 1,
 * BOOT-04, D-1.8).
 *
 * <p>Mirrors the rectrace module's SecurityConfig: permits all requests,
 * disables CSRF (REST API), and is scoped to non-{@code test} profiles so the
 * existing context-load test contract from Phase 0 D-05 stays green
 * (D-1.17). Real authentication is deferred to Phase 9 (D-1.9, T-1-SEC-01);
 * the explicit bean is present to defeat Spring Security's auto-generated
 * default-credentials fallback that activates when
 * {@code spring-boot-starter-security} lands on the classpath
 * (T-1-SEC-04).
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
