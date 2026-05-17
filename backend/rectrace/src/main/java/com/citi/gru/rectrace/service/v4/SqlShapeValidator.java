package com.citi.gru.rectrace.service.v4;

import net.sf.jsqlparser.parser.CCJSqlParserUtil;
import net.sf.jsqlparser.statement.Statement;
import net.sf.jsqlparser.statement.select.PlainSelect;
import net.sf.jsqlparser.statement.select.Select;
import net.sf.jsqlparser.statement.select.SelectVisitorAdapter;
import net.sf.jsqlparser.statement.select.SetOperationList;
import net.sf.jsqlparser.statement.select.WithItem;

/**
 * Phase 5 / SQL-02 + SQL-05 — pure-function shape validator for config-authored SQL tabs.
 *
 * <p>Parses a config-authored query with JSqlParser 5.x and asserts:
 * <ul>
 *   <li>The statement is a {@code SELECT} or {@code WITH ... SELECT} (covers
 *       {@link Select}, which is the parent type of {@link PlainSelect},
 *       {@link SetOperationList}, and {@link WithItem}-bearing selects).</li>
 *   <li>Somewhere in the AST there is a {@code WHERE} clause OR a {@code FETCH FIRST}/{@code LIMIT}.
 *       Either alone is sufficient (D-5.10 — "any presence counts"); both is fine.</li>
 * </ul>
 *
 * <p>On violation, throws {@link IllegalStateException} whose message includes the offending
 * tab key. Callers are expected to propagate this from {@code @PostConstruct} so Spring's
 * context init fails and the application refuses to boot (SQL-02 + SQL-05 defense in depth).
 *
 * <p>This class is pure: it does not touch the database and has no Spring lifecycle.
 */
public final class SqlShapeValidator {

    private SqlShapeValidator() {
        // utility class — no instances
    }

    /**
     * Validate the shape of a config-authored SQL string.
     *
     * @param key tab key (echoed back in error messages for grep-ability)
     * @param sql the configured query string
     * @throws IllegalStateException if the SQL does not parse, is not a SELECT/WITH,
     *                               or is missing both WHERE and FETCH/LIMIT
     */
    public static void validate(String key, String sql) {
        final Statement stmt;
        try {
            stmt = CCJSqlParserUtil.parse(sql);
        } catch (Exception e) {
            throw new IllegalStateException(
                "SQL tab [" + key + "] failed to parse: " + e.getMessage(), e);
        }

        if (!(stmt instanceof Select select)) {
            throw new IllegalStateException(
                "SQL tab [" + key + "] is not a SELECT / WITH statement");
        }

        ShapeProbe probe = new ShapeProbe();
        select.accept(probe, null);

        if (!probe.hasWhere && !probe.hasLimitOrFetch) {
            throw new IllegalStateException(
                "SQL tab [" + key + "] is missing both WHERE and FETCH FIRST/LIMIT — "
                    + "runaway scans rejected (SQL-05)");
        }
    }

    /**
     * Visitor that walks PlainSelect / SetOperationList / WithItem nodes and flips
     * the two boolean flags as soon as ANY presence is detected anywhere in the tree.
     *
     * <p>Per D-5.10, any presence of a WHERE (top-level, nested, CTE body, set-operation
     * member) counts. Same for FETCH/LIMIT. The visitor's job is only to surface presence;
     * stricter scoping rules are deferred to a future phase.
     */
    private static final class ShapeProbe extends SelectVisitorAdapter<Void> {
        boolean hasWhere;
        boolean hasLimitOrFetch;

        @Override
        public <S> Void visit(PlainSelect plainSelect, S context) {
            if (plainSelect.getWhere() != null) {
                hasWhere = true;
            }
            if (plainSelect.getLimit() != null || plainSelect.getFetch() != null) {
                hasLimitOrFetch = true;
            }
            // Recurse into WITH items attached to this PlainSelect (CTEs declared on the body).
            if (plainSelect.getWithItemsList() != null) {
                for (WithItem<?> withItem : plainSelect.getWithItemsList()) {
                    withItem.accept(this, context);
                }
            }
            return null;
        }

        @Override
        public <S> Void visit(SetOperationList setOpList, S context) {
            // UNION / INTERSECT / EXCEPT — visit each member.
            if (setOpList.getSelects() != null) {
                for (Select member : setOpList.getSelects()) {
                    member.accept(this, context);
                }
            }
            if (setOpList.getLimit() != null || setOpList.getFetch() != null) {
                hasLimitOrFetch = true;
            }
            // Recurse into WITH items attached to the set-operation list.
            if (setOpList.getWithItemsList() != null) {
                for (WithItem<?> withItem : setOpList.getWithItemsList()) {
                    withItem.accept(this, context);
                }
            }
            return null;
        }

        @Override
        public <S> Void visit(WithItem<?> withItem, S context) {
            // CTE body — recurse into the inner SELECT.
            if (withItem.getSelect() != null) {
                withItem.getSelect().accept(this, context);
            }
            return null;
        }
    }
}
