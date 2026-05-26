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

// Optional per-category embedded dashboard (e.g. an iframe overview panel).
// Backend emits camelCase keys: url / title / defaultOpen / height.
export const DashboardConfigV4Schema = z.object({
  url: z.string(),
  title: z.string().nullish(),
  defaultOpen: z.boolean().nullish(),
  height: z.number().nullish(),
})

export const CategoryConfigV4Schema = z.object({
  key: z.string(),
  label: z.string(),
  searchColumn: z.string(),
  // Widened to `.nullish()` so a dashboard-only category (which carries no
  // ES / Oracle / column wiring) parses against the /config response.
  elasticsearch: z.record(z.unknown()).nullish(),
  oracle: z.record(z.unknown()).nullish(),
  columns: z.array(ColumnDefinitionV4Schema).nullish(),
  dashboard: DashboardConfigV4Schema.nullish(),
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
  // `columns` stays STRICT here: the backend `/initial` guard always
  // coalesces it to `[]`, so it is never null/undefined on the wire.
  columns: z.array(ColumnDefinitionV4Schema),
  dashboard: DashboardConfigV4Schema.nullish(),
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
// Export request body (POST /api/v4/search/export/{category})
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportRequestV4 {
  category: string
  initialFilter: InitialFilter | null
  columns: string[]
  rowGroupCols: string[]
  sortModel: SortModelItem[]
  filterModel: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Inferred TypeScript types — downstream Phase 3 plans import from here.
// ─────────────────────────────────────────────────────────────────────────────

export type ColumnDefinitionV4 = z.infer<typeof ColumnDefinitionV4Schema>
export type DashboardConfigV4 = z.infer<typeof DashboardConfigV4Schema>
export type CategoryConfigV4 = z.infer<typeof CategoryConfigV4Schema>
export type SearchConfigurationV4 = z.infer<typeof SearchConfigurationV4Schema>
export type InitialFilter = z.infer<typeof InitialFilterSchema>
export type CategoryResultV4 = z.infer<typeof CategoryResultV4Schema>
export type InitialSearchResponseV4 = z.infer<typeof InitialSearchResponseV4Schema>
export type SortModelItem = z.infer<typeof SortModelItemSchema>
export type SSRMRequestV4 = z.infer<typeof SSRMRequestV4Schema>
