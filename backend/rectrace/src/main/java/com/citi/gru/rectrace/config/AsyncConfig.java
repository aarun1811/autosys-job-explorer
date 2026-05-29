package com.citi.gru.rectrace.config;

import java.util.concurrent.Executor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.support.ContextPropagatingTaskDecorator;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import io.micrometer.context.ContextRegistry;
import io.micrometer.context.integration.Slf4jThreadLocalAccessor;
import jakarta.annotation.PostConstruct;

/**
 * {@code taskExecutor} pool for {@code @Async} methods.
 *
 * <p>Phase 7 / OBS-06 — the {@link ContextPropagatingTaskDecorator} (Boot 3.2+ built-in,
 * per D-7.6 / Pitfall A4) copies the calling thread's MDC, Brave TraceContext, Security
 * context and ServletRequestAttributes onto the worker thread before the task runs, then
 * tears them down via {@code ContextSnapshot.Scope.close()} on the worker thread when the
 * task returns. We deliberately do NOT hand-roll an MDC-copying decorator — the built-in
 * decorator handles thread-pool reuse semantics correctly (released captured context after
 * each task, no leak between tasks scheduled to the same worker thread; Threat T-07-19).
 */
@Configuration
public class AsyncConfig {

    /**
     * Register a global {@link Slf4jThreadLocalAccessor} so that
     * {@link ContextPropagatingTaskDecorator} (which captures via
     * {@code ContextSnapshotFactory.getInstance().captureAll()}) picks up the
     * SLF4J MDC map. Without this registration, the decorator captures only
     * accessors auto-registered by other libraries (e.g. {@code ObservationThreadLocalAccessor}
     * from micrometer-tracing) and the MDC map is silently dropped on the
     * worker thread. {@link ContextRegistry} dedupes by key, so multiple
     * registrations of the same accessor key are idempotent.
     */
    @PostConstruct
    public void registerSlf4jMdcAccessor() {
        ContextRegistry.getInstance().registerThreadLocalAccessor(new Slf4jThreadLocalAccessor());
    }

    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("AsyncSearch-");
        // OBS-06: propagate MDC traceId/userId + Brave TraceContext + Security +
        // RequestContext from caller to async worker thread (D-7.6 / Pitfall A4).
        executor.setTaskDecorator(new ContextPropagatingTaskDecorator());
        executor.initialize();
        return executor;
    }
}
