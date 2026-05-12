package com.citi.gru.rectrace.util;

import java.io.BufferedReader;
import java.io.InputStreamReader;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ScriptExecutor {

    private static final Logger logger = LoggerFactory.getLogger(ScriptExecutor.class);

    public String executeScript(String scriptPath, String serviceName, String dbSchema) {
        String password = "";
        ProcessBuilder processBuilder = new ProcessBuilder(new String[] { scriptPath, "@" + serviceName,dbSchema });
        processBuilder.redirectErrorStream(true);

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
