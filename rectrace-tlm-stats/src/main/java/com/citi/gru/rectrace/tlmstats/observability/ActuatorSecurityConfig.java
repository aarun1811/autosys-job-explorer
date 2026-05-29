package com.citi.gru.rectrace.tlmstats.observability;

import org.springframework.boot.actuate.autoconfigure.security.servlet.EndpointRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * OBS-03 / D-7.3 — tlm-stats mirror of backend/rectrace's actuator security stub.
 *
 * <p>Ships <strong>exposure lockdown only</strong>. Phase 9 (SEC-01) hardens
 * AUTH on the privileged endpoints {@code /actuator/loggers} and
 * {@code /actuator/metrics} by swapping {@code permitAll()} for
 * {@code authenticated()} and adding an authentication provider — no other
 * structural change to this class is required.
 *
 * <p>Why a dedicated SecurityFilterChain? The Phase 1 {@code SecurityConfig}
 * (in {@code com.citi.gru.rectrace.tlmstats.config}) is a single permissive
 * chain matching all paths and is {@code @Profile("!test")}. To enforce
 * different rules on {@code /actuator/**} without disturbing the rest of the
 * app, we register a second chain at {@link Ordered#HIGHEST_PRECEDENCE} whose
 * {@code securityMatcher} narrows to {@link EndpointRequest#toAnyEndpoint()}.
 * Spring Security routes each request to the FIRST chain whose matcher accepts
 * it — so actuator paths are governed by this chain and everything else falls
 * through to the Phase 1 chain.
 *
 * <p>Unlike the Phase 1 {@code SecurityConfig} (which is {@code @Profile("!test")}),
 * this bean is active in ALL profiles. Reason: Plan 07-04's
 * {@code ActuatorExposureTest} runs under {@code @ActiveProfiles("test")} with
 * {@code @AutoConfigureMockMvc} and needs a chain that permits
 * {@code /actuator/**} — otherwise Spring Security's default chain returns 401
 * for anonymous actuator probes. The bean is permissive (permitAll) so it has
 * no negative effect on other test paths; the Phase 1 SecurityConfig with
 * broader {@code anyRequest()} permitAll remains profile-guarded.
 *
 * <p>Decision refs: D-7.3, T-07-10 (accepted risk — Phase 7 stub permits all
 * actuator traffic; Phase 9 SEC-01 closes this).
 */
@Configuration
@EnableWebSecurity
public class ActuatorSecurityConfig {

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public SecurityFilterChain actuatorChain(HttpSecurity http) throws Exception {
        // Phase 7 ships EXPOSURE lockdown only (D-7.3). Phase 9 hardens AUTH on
        // /actuator/loggers and /actuator/metrics by swapping permitAll() for
        // authenticated() and adding an authentication provider.
        http
            .securityMatcher(EndpointRequest.toAnyEndpoint())
            .authorizeHttpRequests(a -> a.anyRequest().permitAll())
            .csrf(c -> c.disable());
        return http.build();
    }
}
