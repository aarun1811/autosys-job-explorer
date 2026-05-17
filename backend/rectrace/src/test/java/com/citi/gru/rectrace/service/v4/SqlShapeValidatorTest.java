package com.citi.gru.rectrace.service.v4;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.stream.Stream;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * Phase 5 / SQL-02 + SQL-05: locks the SqlShapeValidator contract at compile time.
 *
 * <p>Wave 0 scaffolding — all tests {@code @Disabled} with the literal {@code "Wave 4: ..."}
 * reason string so Wave 4 can grep-enable them by deleting the {@code @Disabled} annotations
 * and switching the {@link #validate(String, String)} call site from the local stub to the
 * real {@code com.citi.gru.rectrace.service.v4.SqlShapeValidator} static import.
 *
 * <p>TODO Wave 4: delete the {@link #validate(String, String)} stub below and replace with
 * {@code import static com.citi.gru.rectrace.service.v4.SqlShapeValidator.validate;}.
 */
class SqlShapeValidatorTest {

    /**
     * TODO Wave 4: remove this stub; switch to the real
     * {@code com.citi.gru.rectrace.service.v4.SqlShapeValidator.validate(...)} static method.
     * The stub exists only so this file compiles standalone in Wave 0.
     */
    private static void validate(String key, String sql) {
        throw new IllegalStateException("stub: replaced by SqlShapeValidator in Wave 4");
    }

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

    @Disabled("Wave 4: enabled when SqlShapeValidator lands")
    @ParameterizedTest
    @MethodSource("validSelectShapes")
    void acceptsValidSelectShapes(String sql) {
        // Wave 4 wires this to the real validator; should not throw for any valid shape.
        assertDoesNotThrow(() -> validate("test", sql));
    }

    @Disabled("Wave 4: enabled when SqlShapeValidator lands")
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
