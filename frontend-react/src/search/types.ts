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

// Many optional fields are serialized as JSON `null` (not omitted) by the
// backend's CategoryColumnV4 DTO. Use `.nullish()` (accepts null OR undefined)
// to match the on-the-wire shape.
export const ColumnDefinitionV4Schema = z.object({
  field: z.string(),
  headerName: z.string(),
  rowGroup: z.boolean().nullish(),
  hide: z.boolean().nullish(),
  sortable: z.boolean().nullish(),
  filter: z.boolean().nullish(),
  resizable: z.boolean().nullish(),
  width: z.number().nullish(),
  cellRenderer: z.string().nullish(),
  cellRendererParams: z.record(z.unknown()).nullish(),
  cellStyle: z.record(z.string()).nullish(),
  pinned: z.enum(['left', 'right']).nullish(),
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

// CategoryResultV4 mirrors the per-category entry actually emitted by the
// backend `/api/v4/search/initial` endpoint (SearchControllerV4 / CategoryResultV4).
// The response does NOT contain a pre-built `{ column, values }` object — the
// React client must combine `values` from this DTO with `searchColumn` from
// the `/config` endpoint to produce the SSRM body's `initialFilter`. Resolves
// RESEARCH.md Open Question #1.
export const CategoryResultV4Schema = z.object({
  key: z.string(),
  label: z.string(),
  values: z.array(z.string()),
  count: z.number(),
  hasMore: z.boolean(),
  columns: z.array(ColumnDefinitionV4Schema),
})

export const InitialSearchResponseV4Schema = z.object({
  categoryResults: z.record(CategoryResultV4Schema),
  searchTerm: z.string().nullish(),
  // Backend sends timestamp as epoch-ms number; accept any (we don't read it).
  timestamp: z.unknown().optional(),
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
