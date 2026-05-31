package com.citi.gru.rectrace.loader.observability.aop;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

import io.micrometer.tracing.Span;
import io.micrometer.tracing.Tracer;

/**
 * Phase 7 / OBS-06 — open a fresh Brave span on every {@code @Scheduled} method
 * invocation so the scheduler's MDC traceId rotates per fire (D-7.10).
 *
 * <p>Without this aspect, every {@code @Scheduled} method in this module would share a
 * single empty MDC because the Spring scheduler thread has no inbound HTTP traceparent
 * header — log lines from sequential fires would collide in trace-aggregation tooling
 * (Splunk). The aspect opens a new {@link Span} via {@link Tracer#nextSpan()}, scopes
 * it with {@link Tracer#withSpan(Span)} (Brave's MDC scope decorator populates
 * {@code MDC.traceId} from the active span), and closes it in a finally block.
 *
 * <p><strong>Module ownership.</strong> Relocated to {@code rectrace-loader/} on
 * 2026-05-31 as part of the loader-extraction cleanup sweep — after the loader subsystem
 * moved out of {@code backend/rectrace}, the backend module has zero {@code @Scheduled}
 * methods and the aspect was orphaned there. The loader module now owns all
 * {@code @Scheduled} methods (e.g. the loader ticker) so the aspect lives next to its
 * pointcut targets.
 *
 * <p>Pitfall P-10: ShedLock's {@code LockingTaskExecutor.executeWithLock(...)} runs the
 * lambda on the caller thread. This aspect wraps the OUTER {@code @Scheduled} method, so
 * the MDC traceId set here is already in place by the time any lock-protected lambda
 * executes.
 */
@Aspect
@Component
public class ScheduledTraceIdAspect {

    private final Tracer tracer;

    public ScheduledTraceIdAspect(Tracer tracer) {
        this.tracer = tracer;
    }

    @Around("@annotation(org.springframework.scheduling.annotation.Scheduled)")
    public Object aroundScheduled(ProceedingJoinPoint pjp) throws Throwable {
        Span span = tracer.nextSpan()
                .name(pjp.getSignature().toShortString())
                .start();
        try (Tracer.SpanInScope ignored = tracer.withSpan(span)) {
            return pjp.proceed();
        } finally {
            span.end();
        }
    }
}
