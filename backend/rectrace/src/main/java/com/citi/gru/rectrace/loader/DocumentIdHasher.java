package com.citi.gru.rectrace.loader;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Phase 6 / LOADER-04 — deterministic Elasticsearch document ID hasher.
 *
 * <p>Given a job's declared primary-key column list and a row from the Oracle source query,
 * produces a stable 16-lowercase-hex-character ID so that re-ingesting the same row yields
 * the same ES {@code _id} — making the bulk operation an idempotent upsert rather than a
 * duplicate insert.
 *
 * <h2>Algorithm</h2>
 * <ol>
 *   <li>Extract the PK column values from {@code row} in <em>declared order</em> as a
 *       {@code List<Object>}. Order is contract-significant: reordering the {@code primaryKey}
 *       list in config re-keys the entire index.</li>
 *   <li>JSON-encode the list via Jackson — this gives an injective serialization that
 *       distinguishes string values containing separator characters from values that don't.</li>
 *   <li>SHA-256 the JSON bytes.</li>
 *   <li>Take the first 8 bytes (64 bits) of the digest and format as 16 lowercase hex chars
 *       via {@link HexFormat#formatHex(byte[], int, int)} (JDK 17+).</li>
 * </ol>
 *
 * <p>64 bits of entropy is safe against birthday collision well past 10^9 documents — orders
 * of magnitude above any rectrace index size.
 *
 * <h2>Pitfall L5 — separator collision</h2>
 * The naive approach of concatenating PK values with a delimiter (e.g. {@code "|"}) collides
 * whenever a PK value contains the delimiter. Consider two distinct rows with PK columns
 * {@code [recon, file_name_pattern]}:
 * <pre>
 *   row1: recon="A",   file_name_pattern="B|C"   → "A|B|C"
 *   row2: recon="A|B", file_name_pattern="C"     → "A|B|C"   ← same!
 * </pre>
 * JSON encoding makes the two unambiguous:
 * <pre>
 *   row1 → ["A","B|C"]
 *   row2 → ["A|B","C"]
 * </pre>
 * because Jackson escapes the array delimiters and brackets but keeps {@code |} as a literal
 * char inside each string — the resulting byte sequences differ at the first {@code "} after
 * the second {@code [}. {@code DocumentIdHasherTest#separatorInPkValueDoesNotCollide} pins this.
 */
@ConditionalOnProperty(name = "rectrace.loader.enabled", havingValue = "true", matchIfMissing = true)
@Component
public final class DocumentIdHasher {

    private final ObjectMapper objectMapper;

    @Autowired
    public DocumentIdHasher(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Compute the 16-hex-char document ID for a row.
     *
     * @param primaryKeyColumns ordered column names from {@code LoaderSourceConfigV4.primaryKey}
     * @param row               column-name → value map for a single Oracle result row
     * @return 16 lowercase hex chars (64 bits of digest entropy)
     * @throws IllegalStateException if Jackson cannot serialize the PK values (should never
     *         happen for plain String/Number/null values from JDBC) or SHA-256 is unavailable
     *         (also should never happen on a standard JVM)
     */
    public String hash(List<String> primaryKeyColumns, Map<String, Object> row) {
        List<Object> pkValues = primaryKeyColumns.stream()
                .map(row::get)
                .toList();

        byte[] payload;
        try {
            payload = objectMapper.writeValueAsBytes(pkValues);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(
                    "Failed to JSON-encode primary-key values for hashing: pkColumns=" + primaryKeyColumns,
                    e);
        }

        byte[] digest;
        try {
            digest = MessageDigest.getInstance("SHA-256").digest(payload);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable on this JVM", e);
        }

        return HexFormat.of().formatHex(digest, 0, 8);
    }
}
