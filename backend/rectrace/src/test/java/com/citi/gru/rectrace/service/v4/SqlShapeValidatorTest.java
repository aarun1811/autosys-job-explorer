package com.citi.gru.rectrace.service.v4;

import static com.citi.gru.rectrace.service.v4.SqlShapeValidator.validate;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.stream.Stream;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * Phase 5 / SQL-02 + SQL-05: locks the SqlShapeValidator contract.
 *
 * <p>Wave 4 (Plan 05-04): enabled — calls the real
 * {@link com.citi.gru.rectrace.service.v4.SqlShapeValidator#validate(String, String)}.
 */
class SqlShapeValidatorTest {

    static Stream<String> validSelectShapes() {
        return Stream.of(
            "SELECT a FROM t WHERE x=1",
            "SELECT a FROM t FETCH FIRST 10 ROWS ONLY",
            "WITH cte AS (SELECT 1 FROM dual WHERE 1=1) SELECT * FROM cte WHERE 1=1",
            "SELECT a FROM t WHERE x=1 UNION SELECT b FROM u WHERE y=2"
        );
    }

    static Stream<Arguments> invalidShapes() {
        return Stream.of(
            Arguments.of("INSERT INTO foo VALUES (1)", "not a SELECT"),
            Arguments.of("UPDATE foo SET a=1", "not a SELECT"),
            Arguments.of("DELETE FROM foo", "not a SELECT"),
            Arguments.of("CREATE TABLE x (a NUMBER)", "not a SELECT"),
            Arguments.of("SELECT * FROM rectrace_core", "missing both WHERE and FETCH")
        );
    }

    @ParameterizedTest
    @MethodSource("validSelectShapes")
    void acceptsValidSelectShapes(String sql) {
        assertDoesNotThrow(() -> validate("test", sql));
    }

    @ParameterizedTest
    @MethodSource("invalidShapes")
    void rejectsInvalidShapes(String sql, String expectedFragment) {
        IllegalStateException ex = assertThrows(
            IllegalStateException.class,
            () -> validate("test", sql));
        assertTrue(
            ex.getMessage() != null && ex.getMessage().contains(expectedFragment),
            () -> "expected message to contain '" + expectedFragment + "' but was: " + ex.getMessage());
    }
}
