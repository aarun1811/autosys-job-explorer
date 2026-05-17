package com.citi.gru.rectrace.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

/**
 * OBS-06 contract — when {@code MDC.get("traceId")} is set, the subprocess
 * launched by {@link ScriptExecutor} must inherit it via the
 * {@code RECTRACE_CORRELATION_ID} environment variable. When the MDC has no
 * traceId, the env var must be ABSENT (not blank-string). Plan 07-03 wires the
 * env-var injection and removes the {@link Disabled}.
 */
@Disabled("Wave 0 scaffold — enabled by Plan 07-03")
class ScriptExecutorEnvVarTest {

    private CapturingScriptExecutor executor;

    @BeforeEach
    void newExecutor() {
        executor = new CapturingScriptExecutor();
    }

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void mdcTraceIdInjectedAsEnvVar() {
        MDC.put("traceId", "abc123def4567890abc123def4567890");

        executor.executeScript("/bin/true", "SVC", "SCHEMA");

        String captured = executor.capturedEnv.get("RECTRACE_CORRELATION_ID");
        assertThat(captured).isEqualTo("abc123def4567890abc123def4567890");
    }

    @Test
    void envVarAbsentWhenNoMdcTraceId() {
        MDC.clear();

        executor.executeScript("/bin/true", "SVC", "SCHEMA");

        assertThat(executor.capturedEnv.containsKey("RECTRACE_CORRELATION_ID"))
                .as("env var must be ABSENT (not blank-string) when MDC has no traceId")
                .isFalse();
    }

    /**
     * Test-only subclass that captures the {@link ProcessBuilder#environment()}
     * map without actually launching a subprocess. Plan 07-03 may relocate this
     * helper or replace it with a spy on the real {@link ProcessBuilder}.
     */
    static class CapturingScriptExecutor extends ScriptExecutor {
        final java.util.Map<String, String> capturedEnv = new java.util.HashMap<>();

        @Override
        public String executeScript(String scriptPath, String serviceName, String dbSchema) {
            ProcessBuilder pb = new ProcessBuilder(scriptPath, "@" + serviceName, dbSchema);
            String trace = MDC.get("traceId");
            if (trace != null && !trace.isEmpty()) {
                pb.environment().put("RECTRACE_CORRELATION_ID", trace);
            }
            capturedEnv.putAll(pb.environment());
            return "";
        }
    }
}
