package com.citi.gru.rectrace.tlmstats.util;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Utility class to execute shell scripts for password retrieval
 */
@Component
public class ScriptExecutor {

    private static final Logger logger = LoggerFactory.getLogger(ScriptExecutor.class);

    /**
     * Executes a shell script with the given arguments
     * 
     * @param scriptPath Path to the shell script
     * @param args Arguments to pass to the script
     * @return The output of the script execution
     * @throws RuntimeException if script execution fails
     */
    public String executeScript(String scriptPath, String... args) {
        try {
            // Build the command array
            String[] command = new String[args.length + 1];
            command[0] = scriptPath;
            System.arraycopy(args, 0, command, 1, args.length);

            logger.debug("Executing script: {} with args: {}", scriptPath, String.join(" ", args));

            // Create process builder
            ProcessBuilder processBuilder = new ProcessBuilder(command);
            processBuilder.redirectErrorStream(true);

            // Start the process
            Process process = processBuilder.start();

            // Read the output
            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }

            // Wait for the process to complete
            int exitCode = process.waitFor();

            if (exitCode != 0) {
                throw new RuntimeException("Script execution failed with exit code: " + exitCode + 
                                         ". Output: " + output.toString());
            }

            String result = output.toString().trim();
            logger.debug("Script executed successfully. Output length: {}", result.length());
            
            return result;

        } catch (IOException | InterruptedException e) {
            logger.error("Failed to execute script: {}", scriptPath, e);
            throw new RuntimeException("Script execution failed", e);
        }
    }
} 