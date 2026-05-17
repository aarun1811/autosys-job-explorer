package com.citi.gru.rectrace.service.v4;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.citi.gru.rectrace.dto.v4.CategoryConfigV4;

/**
 * Phase 8 / BUG-02 regression: hyphenated identifiers (e.g. {@code RECON-XYZ-42},
 * {@code RID-XYZ-42}, {@code SET-ABC-123}) must return at least one Elasticsearch hit
 * through {@link ElasticsearchServiceV4#getUniqueValues(String, CategoryConfigV4)}.
 *
 * <p>Pre-fix behaviour: {@code pattern = "*" + keyword.toLowerCase() + "*"} run against
 * the {@code .keyword} subfield (case-preserving) returned zero hits. The fix adds
 * {@code caseInsensitive(true)} on the {@code .keyword}-branch wildcards.
 *
 * <p>Gated by {@code -Des.live=true} so this test SKIPS cleanly in CI without a live
 * Elasticsearch cluster. Run locally with:
 * <pre>
 *   cd backend/rectrace
 *   mvn test -Dtest=HyphenSearchRegressionTest -Des.live=true \
 *     -Dspring.profiles.active=local
 * </pre>
 *
 * <p>Test inputs intentionally align with the Phase 0.1 seed values verified in
 * HYPHEN-DIAGNOSTIC.md (live {@code GET /rectrace_core_index/_search}):
 * <ul>
 *   <li>{@code reconId} category: keyword {@code RID-XYZ-42} → seed field {@code recon_id}</li>
 *   <li>{@code jobName} category: keyword {@code RECON-XYZ-42} → seed field {@code job_name}</li>
 *   <li>{@code setId} category: keyword {@code SET-ABC-123} → seed field {@code set_id}</li>
 * </ul>
 */
@SpringBootTest
@ActiveProfiles("local")
@EnabledIfSystemProperty(named = "es.live", matches = "true")
class HyphenSearchRegressionTest {

    @Autowired
    private ElasticsearchServiceV4 elasticsearchService;

    @Autowired
    private SearchConfigServiceV4 searchConfigService;

    @Test
    @DisplayName("BUG-02: hyphenated reconId lookup returns ≥1 hit containing RID-XYZ-42")
    void hyphenatedReconIdReturnsAtLeastOneHit() {
        CategoryConfigV4 reconIdConfig = searchConfigService.getCategoryConfig("reconId");

        List<String> results = elasticsearchService.getUniqueValues("RID-XYZ-42", reconIdConfig);

        assertThat(results)
                .as("reconId search for 'RID-XYZ-42' must return seeded hit; "
                        + "lowercased wildcard vs case-preserved .keyword would return 0")
                .isNotEmpty()
                .anyMatch(v -> v.equalsIgnoreCase("RID-XYZ-42"));
    }

    @Test
    @DisplayName("BUG-02: hyphenated jobName lookup returns ≥1 hit containing RECON-XYZ-42")
    void hyphenatedJobNameReturnsAtLeastOneHit() {
        CategoryConfigV4 jobNameConfig = searchConfigService.getCategoryConfig("jobName");

        List<String> results = elasticsearchService.getUniqueValues("RECON-XYZ-42", jobNameConfig);

        assertThat(results)
                .as("jobName search for 'RECON-XYZ-42' must return seeded hit")
                .isNotEmpty()
                .anyMatch(v -> v.equalsIgnoreCase("RECON-XYZ-42"));
    }

    @Test
    @DisplayName("BUG-02: hyphenated setId lookup returns ≥1 hit containing SET-ABC-123")
    void hyphenatedSetIdReturnsAtLeastOneHit() {
        CategoryConfigV4 setIdConfig = searchConfigService.getCategoryConfig("setId");

        List<String> results = elasticsearchService.getUniqueValues("SET-ABC-123", setIdConfig);

        assertThat(results)
                .as("setId search for 'SET-ABC-123' must return seeded hit")
                .isNotEmpty()
                .anyMatch(v -> v.equalsIgnoreCase("SET-ABC-123"));
    }

    @Test
    @DisplayName("BUG-02: mixed-case user input ('recon-xyz-42') still matches uppercase seed")
    void mixedCaseHyphenatedInputStillReturnsHit() {
        CategoryConfigV4 jobNameConfig = searchConfigService.getCategoryConfig("jobName");

        // User types all-lowercase even though indexed term is uppercase RECON-XYZ-42.
        // Proves the .keyword-branch wildcard runs case-insensitively.
        List<String> results = elasticsearchService.getUniqueValues("recon-xyz-42", jobNameConfig);

        assertThat(results)
                .as("mixed-case typing must still produce a hit; this proves caseInsensitive(true)")
                .isNotEmpty()
                .anyMatch(v -> v.equalsIgnoreCase("RECON-XYZ-42"));
    }
}
