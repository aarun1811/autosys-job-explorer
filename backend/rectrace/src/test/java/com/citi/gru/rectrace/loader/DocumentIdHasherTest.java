package com.citi.gru.rectrace.loader;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.fail;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

/**
 * Phase 6 / LOADER-04 — Wave-0 contract scaffold for deterministic document ID hashing.
 *
 * <p>Wave-0 scaffold per Plan 06-02. All methods @Disabled until Plan 06-03 enables this class.
 *
 * <p>The target class {@code com.citi.gru.rectrace.loader.DocumentIdHasher} is introduced by
 * Plan 06-03 and computes a stable 16-hex-char ID from a row's natural primary-key columns so
 * that re-ingestion is idempotent (same row in Oracle → same ES doc ID → upsert, not duplicate).
 *
 * <p>This is plain JUnit — no Spring context needed. The hasher is a pure function.
 *
 * <p>Pitfall L5 (separator collision): the implementation must use a separator that cannot
 * appear inside any individual PK column value. The {@code separatorInPkValueDoesNotCollide}
 * test pins this — see the {@code recon} + {@code file_name_pattern} adversarial pair below.
 * Plan 06-03 will likely use a length-prefixed concatenation (e.g. {@code "5:recon|7:pattern"})
 * or a non-printable separator (e.g. {@code }) plus SHA-256-truncated-to-16-hex.
 */
@Disabled("Wave 0 / Plan 06-02 — enabled when DocumentIdHasher is implemented in Plan 06-03")
class DocumentIdHasherTest {

    @Test
    void sameRowProducesSameIdAcrossInvocations() {
        // Plan 06-03: Map<String,Object> pk = Map.of("recon","R1","file_name_pattern","P1");
        // String a = hasher.hash(pk); String b = hasher.hash(pk); assertThat(a).isEqualTo(b);
        fail("LOADER-04: identical input must produce identical hash (idempotent re-ingestion)");
    }

    @Test
    void differentRowsProduceDifferentIds() {
        // Plan 06-03: two distinct PK maps must yield different IDs.
        // assertThat(hasher.hash(row1)).isNotEqualTo(hasher.hash(row2));
        fail("LOADER-04: distinct rows must produce distinct hashes");
    }

    @Test
    void idIs16HexChars() {
        // Plan 06-03: assertThat(hasher.hash(any)).matches("^[a-f0-9]{16}$");
        // 16 hex chars = 64 bits of entropy — safe against birthday collision up to
        // ~4 billion documents (well above any single rectrace index size).
        assertThat("").as("LOADER-04: hash must be 16 lowercase-hex characters").matches("^[a-f0-9]{16}$");
    }

    @Test
    void separatorInPkValueDoesNotCollide() {
        // Plan 06-03 / Pitfall L5: pk1 = {recon:"A", file_name_pattern:"B|C"} and
        // pk2 = {recon:"A|B", file_name_pattern:"C"} must produce DIFFERENT hashes.
        // The naive concatenation "A|B|C" would collide. Implementation must use
        // length-prefix, escaped delimiter, or non-printable separator.
        // assertThat(hasher.hash(pk1)).isNotEqualTo(hasher.hash(pk2));
        fail("LOADER-04 / Pitfall L5: separator-in-value must not produce hash collision");
    }
}
