package com.citi.gru.rectrace.observability.aop;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/**
 * Phase 7 / OBS-04 — emit a single WARN log line when a JdbcTemplate call (or a
 * {@link SlowLog}-annotated method) takes longer than
 * {@code observability.slow-query-threshold-ms} (default 500 ms).
 *
 * <h2>Pointcut shape</h2>
 * Two {@code @Around} advices:
 * <ol>
 *   <li>{@code execution(* org.springframework.jdbc.core.JdbcTemplate.query*(..))} (and
 *       sibling {@code update*}, {@code execute*}, {@code batchUpdate*}) — targets the
 *       <strong>concrete</strong> {@link org.springframework.jdbc.core.JdbcTemplate} class,
 *       NOT the {@code Jdbc-Operations} interface. {@code NamedParameterJdbcTemplate}
 *       delegates to {@code JdbcTemplate}; if the pointcut were on the interface, the same
 *       logical query would fire the aspect twice (Pitfall P-6 / Threat T-07-18).</li>
 *   <li>{@code @annotation(SlowLog)} — covers service-layer methods that wrap non-JDBC
 *       calls (e.g. ES client SDKs).</li>
 * </ol>
 *
 * <h2>{@code @Profile("!test")} gate</h2>
 * The aspect is excluded from the {@code test} profile (Pitfall P-9): every Spring test
 * boot would otherwise run with the advice in place, slowing test execution and producing
 * noisy WARN lines on unrelated JDBC calls. Tests that want to exercise the aspect register
 * it explicitly via a {@code @TestConfiguration}.
 *
 * <h2>Log shape</h2>
 * One line per slow call, format:
 * <pre>slow-{tag} method={Class.method(..)} durationMs={long} arg0={truncated-bind-arg}</pre>
 * Bind args are truncated to 200 chars per arg (D-7.4 / Threat T-07-15: a SQL string can
 * embed secrets; the truncation cap is a defense-in-depth cap, not a primary guarantee).
 */
@Aspect
@Component
@Profile("!test")
@Slf4j
public class SlowQueryLoggerAspect {

    /** Per Threat T-07-15 / D-7.4 — bind-arg truncation cap. */
    static final int MAX_ARG_CHARS = 200;

    private final long thresholdMs;

    public SlowQueryLoggerAspect(@Value("${observability.slow-query-threshold-ms:500}") long thresholdMs) {
        this.thresholdMs = thresholdMs;
    }

    @Around("execution(* org.springframework.jdbc.core.JdbcTemplate.query*(..)) "
            + "|| execution(* org.springframework.jdbc.core.JdbcTemplate.update*(..)) "
            + "|| execution(* org.springframework.jdbc.core.JdbcTemplate.execute*(..)) "
            + "|| execution(* org.springframework.jdbc.core.JdbcTemplate.batchUpdate*(..))")
    public Object aroundJdbc(ProceedingJoinPoint pjp) throws Throwable {
        return timeAndMaybeWarn(pjp, "jdbc");
    }

    @Around("@annotation(com.citi.gru.rectrace.observability.aop.SlowLog) "
            + "|| @within(com.citi.gru.rectrace.observability.aop.SlowLog)")
    public Object aroundSlowLog(ProceedingJoinPoint pjp) throws Throwable {
        return timeAndMaybeWarn(pjp, "slowlog");
    }

    private Object timeAndMaybeWarn(ProceedingJoinPoint pjp, String tag) throws Throwable {
        long start = System.nanoTime();
        try {
            return pjp.proceed();
        } finally {
            long durationMs = (System.nanoTime() - start) / 1_000_000L;
            if (durationMs >= thresholdMs) {
                String firstArg = firstArgPreview(pjp.getArgs());
                log.warn("slow-{} method={} durationMs={} arg0={}",
                        tag,
                        pjp.getSignature().toShortString(),
                        durationMs,
                        firstArg);
            }
        }
    }

    private static String firstArgPreview(Object[] args) {
        if (args == null || args.length == 0 || args[0] == null) {
            return "<none>";
        }
        return truncate(args[0].toString(), MAX_ARG_CHARS);
    }

    static String truncate(String s, int max) {
        if (s == null) {
            return "";
        }
        if (s.length() <= max) {
            return s;
        }
        return s.substring(0, max) + "...(" + s.length() + " chars)";
    }
}
