package com.citi.gru.rectrace.service.v4;

import com.citi.gru.rectrace.dto.v4.CategoryConfigV4;
import com.citi.gru.rectrace.dto.v4.ColumnDefinition;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Allow-list guard for user-supplied column names and sort directions in SSRM requests.
 *
 * <p>Built from a {@link CategoryConfigV4} — only column field names declared in the
 * category's {@code columns[]} list (plus its {@code searchColumn}) are accepted. Any
 * value supplied by the AG-Grid client that does not appear in the whitelist is rejected
 * before reaching SQL concatenation. Closes the column-name SQL-injection surface in
 * {@link OracleServiceV4} (ORDER BY / WHERE / SELECT / GROUP BY).
 */
public final class ColumnNameWhitelist {

    private final Set<String> allowedColumns;

    private ColumnNameWhitelist(Set<String> allowedColumns) {
        this.allowedColumns = Set.copyOf(allowedColumns);
    }

    public static ColumnNameWhitelist forCategory(CategoryConfigV4 config) {
        Set<String> allowed = new HashSet<>();
        if (config.getColumns() != null) {
            for (ColumnDefinition column : config.getColumns()) {
                if (column != null && column.getField() != null && !column.getField().isEmpty()) {
                    allowed.add(column.getField());
                }
            }
        }
        if (config.getSearchColumn() != null && !config.getSearchColumn().isEmpty()) {
            allowed.add(config.getSearchColumn());
        }
        return new ColumnNameWhitelist(allowed);
    }

    public void requireAllowed(String column) {
        if (column == null || column.isEmpty() || !allowedColumns.contains(column)) {
            throw new IllegalArgumentException("Column not in category whitelist: " + column);
        }
    }

    public boolean isAllowed(String column) {
        return column != null && !column.isEmpty() && allowedColumns.contains(column);
    }

    public static String requireSortDirection(String direction) {
        if (direction == null) {
            throw new IllegalArgumentException("Sort direction must be ASC or DESC: null");
        }
        String upper = direction.toUpperCase(Locale.ROOT);
        if (!"ASC".equals(upper) && !"DESC".equals(upper)) {
            throw new IllegalArgumentException("Sort direction must be ASC or DESC: " + direction);
        }
        return upper;
    }
}
