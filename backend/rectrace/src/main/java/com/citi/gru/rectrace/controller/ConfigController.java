package com.citi.gru.rectrace.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Per-environment runtime config the React app fetches at boot.
 *
 * Lets a single jar work across UAT / PROD without rebuilding the frontend
 * for each env. The React app calls {@code GET /rectrace/api/config} once,
 * caches the result, and uses {@code recvizOrigin} when building TLM /
 * QuickRec embed URLs.
 *
 * Driven by the {@code app.recviz.origin} property, set in the active profile's
 * properties file (e.g. {@code application-prod.properties} /
 * {@code application-citi.properties}) to the RecViz server origin. Defaults to an
 * empty string when unset, in which case the frontend falls back to its build-time
 * {@code VITE_RECVIZ_ORIGIN} env var, then to {@code http://localhost:8000}.
 */
@RestController
@RequestMapping("/api/config")
public class ConfigController {

    @Value("${app.recviz.origin:}")
    private String recvizOrigin;

    @GetMapping
    public ResponseEntity<Map<String, String>> getConfig() {
        return ResponseEntity.ok(Map.of("recvizOrigin", recvizOrigin));
    }
}
