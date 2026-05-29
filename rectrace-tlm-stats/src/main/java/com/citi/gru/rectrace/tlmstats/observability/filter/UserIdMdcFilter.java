package com.citi.gru.rectrace.tlmstats.observability.filter;

import java.io.IOException;
import java.util.regex.Pattern;

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
 * OBS-01 / D-7.11 — tlm-stats mirror of backend/rectrace's {@code UserIdMdcFilter}.
 * Populates the {@code userId} MDC key from the {@code x-citiportal-loginid} request
 * header so the structured access log line emitted by {@link AccessLogFilter} can be
 * attributed back to a user.
 *
 * <p>Order: {@link Ordered#HIGHEST_PRECEDENCE} + 100. This places the filter
 * AFTER Phase 2's {@code CorrelationIdPropagationConfig} (which sits at
 * {@code HIGHEST_PRECEDENCE} and is responsible for putting {@code traceId}
 * into MDC) and BEFORE {@link AccessLogFilter} (at {@code LOWEST_PRECEDENCE}).
 *
 * <p>Security (T-07-05 — log injection): the header value flows directly into
 * MDC and from there into the JSON log line. Without validation, a CR/LF or
 * formatting character in the header could forge a second log entry. The
 * regex {@code ^[A-Za-z0-9._-]{1,64}$} is the trust-boundary check (identical
 * to backend/rectrace so Splunk schemas match).
 *
 * <p>Pitfall P-3 — MDC cleanup: every {@code MDC.put} is paired with a
 * {@code MDC.remove} in a {@code finally} block so a Tomcat-pooled worker
 * thread cannot leak a previous request's {@code userId} into the next
 * request handled by the same thread.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 100)
public class UserIdMdcFilter extends OncePerRequestFilter {

    static final String HEADER = "x-citiportal-loginid";
    static final String MDC_KEY = "userId";
    static final Pattern LOGIN_ID = Pattern.compile("^[A-Za-z0-9._-]{1,64}$");

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                    HttpServletResponse res,
                                    FilterChain chain)
            throws ServletException, IOException {
        try {
            String raw = req.getHeader(HEADER);
            if (raw != null && LOGIN_ID.matcher(raw).matches()) {
                MDC.put(MDC_KEY, raw);
            }
            chain.doFilter(req, res);
        } finally {
            // Unconditional remove (Pitfall P-3): defends against a previous
            // request leaking a userId via thread pool reuse, even when this
            // request did not set one.
            MDC.remove(MDC_KEY);
        }
    }
}
