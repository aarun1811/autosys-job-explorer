package com.citi.gru.rectrace.loader;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.fail;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

/**
 * Phase 6 / LOADER-01 — Wave-0 contract scaffold for {@code LoaderConfigService}.
 *
 * <p>Wave-0 scaffold per Plan 06-02. All methods @Disabled until Plan 06-03 enables this class.
 *
 * <p>The target class {@code com.citi.gru.rectrace.loader.LoaderConfigService} is introduced by
 * Plan 06-03 and is responsible for loading {@code loader-config.json} at boot via
 * {@code @PostConstruct}, exposing the list of {@code LoaderJobDefV4}, and failing fast on
 * malformed config (duplicate keys, blank schedule, unknown ES alias). The latter check is the
 * cross-cutting boundary that mitigates Pitfall L2 ("aliases declared in config but absent in
 * the ES cluster on boot").
 *
 * <p>Plan 06-03 enables these by (a) removing the class-level {@code @Disabled}, (b) providing
 * the bad-fixture JSON resources alongside {@code loader-config.json} on the test classpath,
 * (c) wiring up {@code @SpringBootTest} + {@code @ActiveProfiles("test")} or instantiating the
 * service directly with a {@code DefaultResourceLoader} (mirrors {@code SqlValidationBootFailureTest}).
 */
@Disabled("Wave 0 / Plan 06-02 — enabled when LoaderConfigService is implemented in Plan 06-03")
class LoaderConfigServiceTest {

    @Test
    void loadsValidConfigAtBoot() {
        // Plan 06-03: assertThat(svc.getJobs()).isNotEmpty();
        // Contract: after @PostConstruct, the service exposes a non-empty list of
        // LoaderJobDefV4 parsed from loader-config.json on the classpath.
        fail("LOADER-01: LoaderConfigService.getJobs() must return non-empty list after @PostConstruct");
    }

    @Test
    void rejectsDuplicateJobKeys() {
        // Plan 06-03: load classpath:loader-config-bad-duplicates.json with two jobs sharing key.
        // Contract: @PostConstruct throws IllegalStateException with message containing "duplicate".
        fail("LOADER-01: duplicate job keys in loader-config must boot-fail with 'duplicate' in message");
    }

    @Test
    void rejectsBlankCron() {
        // Plan 06-03: load classpath:loader-config-bad-blank-cron.json with empty schedule.
        // Contract: @PostConstruct throws IllegalStateException with "schedule" or "cron" in message.
        fail("LOADER-01: blank cron schedule must boot-fail with 'schedule'/'cron' in message");
    }

    @Test
    void failsBootIfAliasMissing() {
        // Plan 06-03: load classpath:loader-config-bad-alias.json that references an unknown ES alias.
        // Contract: @PostConstruct throws IllegalStateException with "alias" in message.
        // This is the Pitfall L2 mitigation evaluated inside the config service boundary
        // (LOADER-03 — full alias resolution lives in the loader job; the config service
        // owns the static config-time check, the job owns the live-cluster check).
        assertThat(false).as("LOADER-01 / Pitfall L2: missing alias must surface at boot").isTrue();
    }
}
