package com.citi.gru.rectrace.tlmstats.config;

import java.util.concurrent.Executor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.support.ContextPropagatingTaskDecorator;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import io.micrometer.context.ContextRegistry;
import io.micrometer.context.integration.Slf4jThreadLocalAccessor;
import jakarta.annotation.PostConstruct;

/**
 * tlm-stats {@code taskExecutor} pool for {@code @Async} methods. Mirror of
 * backend/rectrace's {@code AsyncConfig}, with pool sizes halved because
 * tlm-stats carries lighter load — no SSRM, no parallel ES, and only a small
 * set of stat-aggregation endpoints.
 *
 * <p>Phase 7 / OBS-06 — the {@link ContextPropagatingTaskDecorator}
 * (Boot 3.2+ built-in, per D-7.6 / Pitfall A4) copies the calling thread's
 * MDC, Brave TraceContext, Security context and ServletRequestAttributes onto
 * the worker thread before the task runs, then tears them down via
 * {@code ContextSnapshot.Scope.close()} on the worker thread when the task
 * returns. We deliberately do NOT hand-roll an MDC-copying decorator — the
 * built-in decorator handles thread-pool reuse semantics correctly
 * (released captured context after each task, no leak between tasks
 * scheduled to the same worker thread; Threat T-07-19).
 *
 * <p>{@code @EnableAsync} on the configuration class also activates Spring's
 * {@code @Async} infrastructure module-wide (tlm-stats had no AsyncConfig
 * prior to Plan 07-04 — verified by greps of @EnableAsync / @Async /
 * ThreadPoolTaskExecutor in the main source tree).
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * Register a global {@link Slf4jThreadLocalAccessor} so that
     * {@link ContextPropagatingTaskDecorator} (which captures via
     * {@code ContextSnapshotFactory.getInstance().captureAll()}) picks up the
     * SLF4J MDC map. Without this registration, the decorator captures only
     * accessors auto-registered by other libraries (e.g.
     * {@code ObservationThreadLocalAccessor} from micrometer-tracing) and the
     * MDC map is silently dropped on the worker thread. {@link ContextRegistry}
     * dedupes by key, so multiple registrations of the same accessor key are
     * idempotent.
     */
    @PostConstruct
    public void registerSlf4jMdcAccessor() {
        ContextRegistry.getInstance().registerThreadLocalAccessor(new Slf4jThreadLocalAccessor());
    }

    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        // Pool sizes halved relative to backend/rectrace — tlm-stats has lighter
        // load (no SSRM, no parallel ES). Adjust if @Async usage grows.
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("TlmStatsAsync-");
        // OBS-06: propagate MDC traceId/userId + Brave TraceContext + Security +
        // RequestContext from caller to async worker thread (D-7.6 / Pitfall A4).
        executor.setTaskDecorator(new ContextPropagatingTaskDecorator());
        executor.initialize();
        return executor;
    }
}
