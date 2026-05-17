import { z } from 'zod'

/**
 * Zod schemas mirroring the backend V4 search DTOs.
 *
 * Single source of truth for the JSON contract between
 * /rectrace/api/v4/search/* and the React app:
 *   - Runtime validation via `<Schema>.parse(json)` at trust boundaries
 *   - Compile-time types via `z.infer<typeof <Schema>>`
 *
 * Backend references:
 *   - backend/rectrace/src/main/resources/search-config-v4.json
 *   - backend/rectrace/src/main/java/com/citi/gru/rectrace/dto/v4/SSRMRequestV4.java
 *
 * Angular interface reference (one-to-one port):
 *   - frontend/rectrace/src/app/services/search-v5.service.ts (lines 6-92)
 *
 * NOTE: cellStyle values are stored with the kebab-case keys from the JSON
 * config (e.g. `align-items`). The kebab-case → camelCase conversion lives in
 * the AG-Grid adapter (Plan 04 — `configToColDefs.ts`), not here.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Column + Category configuration (response of GET /api/v4/search/config)
// ─────────────────────────────────────────────────────────────────────────────

export const ColumnDefinitionV4Schema = z.object({
  field: z.string(),
  headerName: z.string(),
  rowGroup: z.boolean().optional(),
  hide: z.boolean().optional(),
  sortable: z.boolean().optional(),
  filter: z.boolean().optional(),
  resizable: z.boolean().optional(),
  width: z.number().optional(),
  cellRenderer: z.string().optional(),
  cellRendererParams: z.record(z.unknown()).optional(),
  cellStyle: z.record(z.string()).optional(),
  pinned: z.enum(['left', 'right']).nullable().optional(),
})

export const CategoryConfigV4Schema = z.object({
  key: z.string(),
  label: z.string(),
  searchColumn: z.string(),
  elasticsearch: z.record(z.unknown()),
  oracle: z.record(z.unknown()),
  columns: z.array(ColumnDefinitionV4Schema),
})

export const SearchConfigurationV4Schema = z.object({
  categories: z.array(CategoryConfigV4Schema),
})

// ─────────────────────────────────────────────────────────────────────────────
// Initial search response (GET /api/v4/search/initial?keyword=…)
// ─────────────────────────────────────────────────────────────────────────────

export const InitialFilterSchema = z.object({
  column: z.string(),
  values: z.array(z.string()),
})

export const CategoryResultV4Schema = z.object({
  category: z.string(),
  initialFilter: InitialFilterSchema,
})

export const InitialSearchResponseV4Schema = z.object({
  categoryResults: z.record(CategoryResultV4Schema),
})

// ─────────────────────────────────────────────────────────────────────────────
// SSRM request body (POST /api/v4/search/ssrm/{category})
// Mirrors backend SSRMRequestV4.java.
// ─────────────────────────────────────────────────────────────────────────────

export const SortModelItemSchema = z.object({
  colId: z.string(),
  sort: z.enum(['asc', 'desc']),
})

export const SSRMRequestV4Schema = z.object({
  category: z.string(),
  initialFilter: InitialFilterSchema.nullable(),
  rowGroupCols: z.array(z.string()),
  groupKeys: z.array(z.string()),
  startRow: z.number(),
  endRow: z.number(),
  sortModel: z.array(SortModelItemSchema),
  filterModel: z.record(z.unknown()),
  visibleColumns: z.array(z.string()),
})

// ─────────────────────────────────────────────────────────────────────────────
// Inferred TypeScript types — downstream Phase 3 plans import from here.
// ─────────────────────────────────────────────────────────────────────────────

export type ColumnDefinitionV4 = z.infer<typeof ColumnDefinitionV4Schema>
export type CategoryConfigV4 = z.infer<typeof CategoryConfigV4Schema>
export type SearchConfigurationV4 = z.infer<typeof SearchConfigurationV4Schema>
export type InitialFilter = z.infer<typeof InitialFilterSchema>
export type CategoryResultV4 = z.infer<typeof CategoryResultV4Schema>
export type InitialSearchResponseV4 = z.infer<typeof InitialSearchResponseV4Schema>
export type SortModelItem = z.infer<typeof SortModelItemSchema>
export type SSRMRequestV4 = z.infer<typeof SSRMRequestV4Schema>
