package com.citi.gru.rectrace.loader;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Phase 6 / LOADER-04 — deterministic document ID hashing contract.
 *
 * <p>Enabled in Plan 06-03. Pure JUnit — the hasher is a pure function and needs no Spring
 * context. The {@code separatorInPkValueDoesNotCollide} test pins Pitfall L5: JSON encoding
 * of the PK value array is injective where naive {@code "|"}-join is not.
 */
class DocumentIdHasherTest {

    private DocumentIdHasher hasher;

    @BeforeEach
    void setUp() {
        hasher = new DocumentIdHasher(new ObjectMapper());
    }

    @Test
    void sameRowProducesSameIdAcrossInvocations() {
        List<String> pkCols = List.of("recon", "file_name_pattern");
        Map<String, Object> row = new HashMap<>();
        row.put("recon", "R1");
        row.put("file_name_pattern", "P1");

        String a = hasher.hash(pkCols, row);
        String b = hasher.hash(pkCols, row);

        assertThat(a).as("LOADER-04: identical input must produce identical hash").isEqualTo(b);
    }

    @Test
    void differentRowsProduceDifferentIds() {
        List<String> pkCols = List.of("recon", "file_name_pattern");
        Map<String, Object> row1 = Map.of("recon", "R1", "file_name_pattern", "P1");
        Map<String, Object> row2 = Map.of("recon", "R2", "file_name_pattern", "P2");

        assertThat(hasher.hash(pkCols, row1))
                .as("LOADER-04: distinct rows must produce distinct hashes")
                .isNotEqualTo(hasher.hash(pkCols, row2));
    }

    @Test
    void idIs16HexChars() {
        List<String> pkCols = List.of("job_name");
        Map<String, Object> row = Map.of("job_name", "anything");

        assertThat(hasher.hash(pkCols, row))
                .as("LOADER-04: hash must be 16 lowercase-hex characters")
                .matches("^[a-f0-9]{16}$");
    }

    @Test
    void separatorInPkValueDoesNotCollide() {
        // Pitfall L5: pk1 = {recon:"A", file_name_pattern:"B|C"} and
        //             pk2 = {recon:"A|B", file_name_pattern:"C"}
        // Naive concatenation "A|B|C" would collide. JSON encoding distinguishes them.
        List<String> pkCols = List.of("recon", "file_name_pattern");

        Map<String, Object> pk1 = Map.of("recon", "A", "file_name_pattern", "B|C");
        Map<String, Object> pk2 = Map.of("recon", "A|B", "file_name_pattern", "C");

        assertThat(hasher.hash(pkCols, pk1))
                .as("LOADER-04 / Pitfall L5: separator-in-value must not produce hash collision")
                .isNotEqualTo(hasher.hash(pkCols, pk2));
    }
}
