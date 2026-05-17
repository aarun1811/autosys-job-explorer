package com.citi.gru.rectrace.observability.aop;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Phase 7 / OBS-04 marker annotation. Methods (or types) annotated with {@code @SlowLog}
 * are picked up by {@link SlowQueryLoggerAspect}'s second pointcut and emit a WARN log
 * line when their wall-clock duration exceeds
 * {@code observability.slow-query-threshold-ms} (default 500 ms).
 *
 * <p>Class-level use applies the advice to every public method on the bean; method-level
 * use is narrower. Use this for service-layer hot paths that are not direct
 * {@link org.springframework.jdbc.core.JdbcTemplate} calls (e.g. wrapped client SDKs).
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface SlowLog {
}
