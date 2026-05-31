package com.citi.gru.rectrace.loader.config;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;

import net.javacrumbs.shedlock.core.DefaultLockingTaskExecutor;
import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.core.LockingTaskExecutor;
import net.javacrumbs.shedlock.provider.jdbctemplate.JdbcTemplateLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;

/**
 * Phase 6 / LOADER-02 — scheduler enablement + ShedLock wiring for the loader subsystem.
 *
 * <p>This class is the single switch that turns on Spring's {@code @Scheduled} processor
 * ({@link EnableScheduling}) and ShedLock's {@code @SchedulerLock} AOP advisor
 * ({@link EnableSchedulerLock}) for the loader subsystem. Both annotations are co-located
 * here — not on {@code RectraceApplication} — per 06-RESEARCH.md Open Question #2 so the
 * scheduler is only active when the loader profile is active (i.e. not in tests).
 *
 * <h2>Profile gate (Pitfall L4)</h2>
 * {@code @Profile("!test")} keeps {@code ContextLoadsTest} green without an Elasticsearch
 * client on the classpath and without the {@code shedlock} table on a test datasource.
 * The same gate is on {@code LoaderConfigService}, {@code LoaderRunHistoryService},
 * {@code LoaderJobRegistry}, {@code OracleToEsLoaderJob}, and {@code LoaderTicker}.
 *
 * <h2>Beans exposed</h2>
 * <ul>
 *   <li>{@link LockProvider} — Oracle-backed via the primary RECTRACE datasource (D-6.12).
 *       Configured with {@code usingDbTime()} (06-RESEARCH.md Pattern 1) so all lock
 *       timestamps come from Oracle — eliminates dev-laptop vs Citi VM clock skew.</li>
 *   <li>{@link LockingTaskExecutor} — {@link DefaultLockingTaskExecutor} wrapping the lock
 *       provider. This is the programmatic API used by {@code LoaderTicker.tick()} to
 *       guard per-job dispatches via {@code executeWithLock(...)}. Programmatic locking
 *       (Pattern 2) is preferred over the {@code @SchedulerLock} annotation because the
 *       lock name {@code "loader:<jobKey>"} is computed at runtime from config —
 *       annotation values must be compile-time constants (06-RESEARCH.md A3).</li>
 * </ul>
 *
 * <h2>{@code defaultLockAtMostFor = "PT55M"}</h2>
 * Pure crash-safety net — NOT the expected run duration. Per 06-RESEARCH.md A10, if a
 * loader pod dies mid-run, ShedLock cannot release the lock; the row will sit until
 * {@code lock_until} expires. 55 minutes leaves headroom over the 30 s tick interval and
 * well under the 1 hour default-cron cadence so a stuck lock is operationally visible.
 * Phase 7 (OBS-02) will add a {@code HealthIndicator} that surfaces runs older than this.
 *
 * <h2>Storage</h2>
 * The shedlock table DDL lives in {@code ../rectrace-local-dev/schema/01-rectrace.sql}
 * (Plan 06-01). Boot fails with a clear error from the JDBC provider if the table is
 * absent — Pitfall L1.
 */
@Configuration
@Profile("!test")
@EnableScheduling
@EnableSchedulerLock(defaultLockAtMostFor = "PT55M")
public class LoaderShedLockConfig {

    /**
     * Oracle-backed {@link LockProvider} wired to the primary RECTRACE datasource.
     *
     * <p>{@code usingDbTime()} delegates {@code now()} to Oracle so the lock provider
     * never relies on JVM wall-clock. {@code @Qualifier("dataSource")} is explicit even
     * though the bean is {@code @Primary} — clarity is cheap.
     */
    @Bean
    public LockProvider lockProvider(@Qualifier("dataSource") DataSource ds) {
        return new JdbcTemplateLockProvider(
                JdbcTemplateLockProvider.Configuration.builder()
                        .withJdbcTemplate(new JdbcTemplate(ds))
                        .usingDbTime()
                        .build());
    }

    /**
     * Programmatic locking executor consumed by {@code LoaderTicker.tick()} (Pattern 2).
     */
    @Bean
    public LockingTaskExecutor lockingTaskExecutor(LockProvider lockProvider) {
        return new DefaultLockingTaskExecutor(lockProvider);
    }
}
