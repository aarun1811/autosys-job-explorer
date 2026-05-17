package com.citi.gru.rectrace.util;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Set;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.slf4j.MDC;

/**
 * OBS-06 contract — when {@code MDC.get("traceId")} is set, the subprocess
 * launched by {@link ScriptExecutor} must inherit it via the
 * {@code RECTRACE_CORRELATION_ID} environment variable. When the MDC has no
 * traceId, the env var must be ABSENT (not blank-string).
 *
 * <p>This test invokes the REAL {@link ScriptExecutor} against a temporary
 * shell script that simply echoes {@code $RECTRACE_CORRELATION_ID} (or a
 * sentinel when unset). The returned first-line-of-stdout is the assertion
 * surface. No subclass / capture-helper required — the verification path is
 * end-to-end through the real {@link ProcessBuilder}.
 */
class ScriptExecutorEnvVarTest {

    @TempDir
    Path tempDir;

    private ScriptExecutor executor;
    private Path script;

    @BeforeEach
    void newExecutor() throws IOException {
        executor = new ScriptExecutor();
        script = tempDir.resolve("echo-correlation-id.sh");
        // The script ignores its positional args and prints either the env-var
        // value or the literal "__ABSENT__" sentinel when the var is not set.
        Files.writeString(script,
                "#!/bin/sh\n"
                        + "if [ -z \"${RECTRACE_CORRELATION_ID+x}\" ]; then\n"
                        + "  echo __ABSENT__\n"
                        + "else\n"
                        + "  echo \"$RECTRACE_CORRELATION_ID\"\n"
                        + "fi\n");
        Set<PosixFilePermission> perms = PosixFilePermissions.fromString("rwxr-xr-x");
        Files.setPosixFilePermissions(script, perms);
    }

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void mdcTraceIdInjectedAsEnvVar() {
        MDC.put("traceId", "abc123def4567890abc123def4567890");

        String output = executor.executeScript(script.toString(), "SVC", "SCHEMA");

        assertThat(output).isEqualTo("abc123def4567890abc123def4567890");
    }

    @Test
    void envVarAbsentWhenNoMdcTraceId() {
        MDC.clear();

        String output = executor.executeScript(script.toString(), "SVC", "SCHEMA");

        assertThat(output)
                .as("env var must be ABSENT (not blank-string) when MDC has no traceId")
                .isEqualTo("__ABSENT__");
    }

    @Test
    void emptyMdcTraceIdTreatedAsAbsent() {
        MDC.put("traceId", "");

        String output = executor.executeScript(script.toString(), "SVC", "SCHEMA");

        assertThat(output)
                .as("blank traceId must not surface as RECTRACE_CORRELATION_ID")
                .isEqualTo("__ABSENT__");
    }
}
