package com.citi.gru.rectrace.util;

import java.io.BufferedReader;
import java.io.InputStreamReader;

public class ScriptExecutor {
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
            e.printStackTrace();
        }
        return password;
    }

}
