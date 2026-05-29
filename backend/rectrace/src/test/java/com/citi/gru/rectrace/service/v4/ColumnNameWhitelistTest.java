package com.citi.gru.rectrace.service.v4;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.citi.gru.rectrace.dto.v4.CategoryConfigV4;
import com.citi.gru.rectrace.dto.v4.ColumnDefinition;
import java.util.List;
import org.junit.jupiter.api.Test;

class ColumnNameWhitelistTest {

    private static CategoryConfigV4 fileNameCategory() {
        return CategoryConfigV4.builder()
            .key("fileName")
            .searchColumn("file_name_pattern")
            .columns(List.of(
                ColumnDefinition.builder().field("file_name_pattern").build(),
                ColumnDefinition.builder().field("app_id").build(),
                ColumnDefinition.builder().field("execution_order").build()
            ))
            .build();
    }

    @Test
    void rejectsColumnNotInConfig() {
        ColumnNameWhitelist whitelist = ColumnNameWhitelist.forCategory(fileNameCategory());

        IllegalArgumentException ex = assertThrows(
            IllegalArgumentException.class,
            () -> whitelist.requireAllowed("file_name_pattern; DROP TABLE rectrace_core"));
        assertTrue(
            ex.getMessage() != null && ex.getMessage().contains("not in category whitelist"),
            () -> "expected message about whitelist, got: " + ex.getMessage());
    }

    @Test
    void rejectsNullColumn() {
        ColumnNameWhitelist whitelist = ColumnNameWhitelist.forCategory(fileNameCategory());
        assertThrows(IllegalArgumentException.class, () -> whitelist.requireAllowed(null));
    }

    @Test
    void rejectsEmptyColumn() {
        ColumnNameWhitelist whitelist = ColumnNameWhitelist.forCategory(fileNameCategory());
        assertThrows(IllegalArgumentException.class, () -> whitelist.requireAllowed(""));
    }

    @Test
    void acceptsConfiguredColumn() {
        ColumnNameWhitelist whitelist = ColumnNameWhitelist.forCategory(fileNameCategory());
        assertDoesNotThrow(() -> whitelist.requireAllowed("app_id"));
        assertDoesNotThrow(() -> whitelist.requireAllowed("file_name_pattern"));
    }

    @Test
    void acceptsSearchColumnEvenIfNotInColumnsList() {
        // searchColumn is server-config-owned and appears in WHERE searchColumn IN (?);
        // include it so server-driven references don't trip the whitelist.
        CategoryConfigV4 config = CategoryConfigV4.builder()
            .key("recon")
            .searchColumn("recon")
            .columns(List.of(ColumnDefinition.builder().field("app_id").build()))
            .build();

        ColumnNameWhitelist whitelist = ColumnNameWhitelist.forCategory(config);

        assertDoesNotThrow(() -> whitelist.requireAllowed("recon"));
    }

    @Test
    void requireSortDirectionRejectsInjection() {
        assertThrows(
            IllegalArgumentException.class,
            () -> ColumnNameWhitelist.requireSortDirection("ASC; DROP TABLE rectrace_core"));
    }

    @Test
    void requireSortDirectionRejectsNull() {
        assertThrows(IllegalArgumentException.class, () -> ColumnNameWhitelist.requireSortDirection(null));
    }

    @Test
    void requireSortDirectionRejectsArbitraryString() {
        assertThrows(IllegalArgumentException.class, () -> ColumnNameWhitelist.requireSortDirection("UNION"));
    }

    @Test
    void requireSortDirectionNormalizesAscAndDesc() {
        assertEquals("ASC", ColumnNameWhitelist.requireSortDirection("asc"));
        assertEquals("ASC", ColumnNameWhitelist.requireSortDirection("ASC"));
        assertEquals("DESC", ColumnNameWhitelist.requireSortDirection("desc"));
        assertEquals("DESC", ColumnNameWhitelist.requireSortDirection("DESC"));
    }
}
