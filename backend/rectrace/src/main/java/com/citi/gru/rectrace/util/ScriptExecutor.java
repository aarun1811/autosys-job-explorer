package com.citi.gru.rectrace.util;

import java.io.BufferedReader;
import java.io.InputStreamReader;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

/**
 * Invokes an external shell script to fetch a database password. Phase 7 / OBS-06 adds
 * trace-context propagation across the JVM → subprocess trust boundary by writing the
 * current {@code MDC.traceId} into the subprocess's {@code RECTRACE_CORRELATION_ID}
 * environment variable.
 *
 * <p>Subprocesses can correlate stdout/stderr with backend logs by reading
 * {@code RECTRACE_CORRELATION_ID}. The variable is present iff {@code MDC.traceId} is set
 * at invocation time. Boot-time DB-password retrieval has no active trace and will not
 * see the variable; this is intentional (the env var is absent, not blank).
 *
 * <p>Per Threat T-07-17 the inheritance of the env var by descendant processes is
 * accepted — the traceId is non-secret by design (already in HTTP headers).
 */
public class ScriptExecutor {

    /** OBS-06: trace-correlation env-var name passed through to child processes. */
    static final String RECTRACE_CORRELATION_ID = "RECTRACE_CORRELATION_ID";

    private static final Logger logger = LoggerFactory.getLogger(ScriptExecutor.class);

    public String executeScript(String scriptPath, String serviceName, String dbSchema) {
        String password = "";
        ProcessBuilder processBuilder = new ProcessBuilder(new String[] { scriptPath, "@" + serviceName, dbSchema });
        processBuilder.redirectErrorStream(true);

        // Phase 7 / OBS-06 — propagate MDC.traceId into the subprocess env so the
        // script's stdout/stderr can be correlated with backend trace lines.
        // Absent (not blank) when no traceId is set — e.g. boot-time password
        // retrieval has no active span and the env var is omitted.
        String traceId = MDC.get("traceId");
        if (traceId != null && !traceId.isEmpty()) {
            processBuilder.environment().put(RECTRACE_CORRELATION_ID, traceId);
        }

        try {
            Process process = processBuilder.start();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                password = reader.readLine();
            }
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                throw new RuntimeException("Script execution failed with exit code: " + exitCode);
            }
        } catch (Exception e) {
            logger.error("Failed to execute password script {} for service {} schema {}", scriptPath, serviceName, dbSchema, e);
        }
        return password;
    }

}
