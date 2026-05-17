package com.citi.gru.rectrace.tlmstats.observability.filter;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * OBS-01 — tlm-stats mirror of backend/rectrace's structured access log. Emits
 * exactly one info-level event on the {@code access} SLF4J logger per HTTP
 * request, with MDC keys {@code path / method / status / durationMs} populated
 * alongside whatever {@code traceId} and {@code userId} are already in MDC from
 * {@code CorrelationIdPropagationConfig} (Phase 2) and {@link UserIdMdcFilter}.
 *
 * <p>Order: {@link Ordered#LOWEST_PRECEDENCE} — runs LAST in the filter chain
 * so {@code res.getStatus()} reflects the final response code, including
 * status set by Spring's exception-translation filter.
 *
 * <p>Pitfall P-3 — MDC cleanup: every {@code MDC.put} for this filter's four
 * keys is paired with a {@code MDC.remove} in a {@code finally} block.
 * Pitfall P-8 — this filter NEVER overwrites the {@code traceId} MDC value;
 * that value is sourced from {@code CorrelationIdPropagationConfig} earlier
 * in the chain and propagated via Brave / Micrometer Tracing.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class AccessLogFilter extends OncePerRequestFilter {

    private static final Logger access = LoggerFactory.getLogger("access");

    static final String MDC_PATH = "path";
    static final String MDC_METHOD = "method";
    static final String MDC_STATUS = "status";
    static final String MDC_DURATION_MS = "durationMs";

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                    HttpServletResponse res,
                                    FilterChain chain)
            throws ServletException, IOException {
        long startNs = System.nanoTime();
        try {
            chain.doFilter(req, res);
        } finally {
            long durationMs = (System.nanoTime() - startNs) / 1_000_000L;
            MDC.put(MDC_PATH, req.getRequestURI());
            MDC.put(MDC_METHOD, req.getMethod());
            MDC.put(MDC_STATUS, Integer.toString(res.getStatus()));
            MDC.put(MDC_DURATION_MS, Long.toString(durationMs));
            try {
                access.info("request");
            } finally {
                MDC.remove(MDC_PATH);
                MDC.remove(MDC_METHOD);
                MDC.remove(MDC_STATUS);
                MDC.remove(MDC_DURATION_MS);
            }
        }
    }
}
