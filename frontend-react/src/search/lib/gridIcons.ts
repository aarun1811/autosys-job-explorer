/**
 * gridIcons — overrides AG-Grid's built-in icon font with lucide SVGs so the
 * grid's chrome (column-menu kebab, filter funnel, sort arrows, group chevrons,
 * tool-panel tree, sidebar tabs, pagination, drag grip) matches the lucide icons
 * used in the GridToolbar and the cell renderers. One consistent icon language
 * across the whole surface.
 *
 * Passed to <AgGridReact icons={gridIcons} />. Each entry returns an inline SVG
 * string sized to `1em` so it inherits the theme's `iconSize`, and stroked with
 * `currentColor` so it follows AG-Grid's icon color in light + dark.
 *
 * Paths are lucide's (24×24 viewBox, stroke-width 2, round caps) — the exact
 * same source family as `lucide-react`, kept as markup here because AG-Grid's
 * icon hook wants an HTML string, not a React node.
 */

const ICON = (inner: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle">${inner}</svg>`

// lucide path data, grouped by glyph.
const KEBAB = '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>'
const GRIP = '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>'
const FUNNEL = '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>'
const ARROW_UP = '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>'
const ARROW_DOWN = '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>'
const CHEVRONS_UP_DOWN = '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>'
const CHEVRON_DOWN = '<path d="m6 9 6 6 6-6"/>'
const CHEVRON_RIGHT = '<path d="m9 18 6-6-6-6"/>'
const CHEVRON_LEFT = '<path d="m15 18-6-6 6-6"/>'
const CHEVRONS_LEFT = '<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>'
const CHEVRONS_RIGHT = '<path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/>'
const COLUMNS = '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>'
const CHECK = '<path d="M20 6 9 17l-5-5"/>'
const X = '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
const PIN = '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>'
const EYE_OFF = '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>'
const ARROW_LR = '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>'
const LIST_TREE = '<path d="M21 12h-8"/><path d="M21 6H8"/><path d="M21 18h-8"/><path d="M3 6v4c0 1.1.9 2 2 2h3"/><path d="M3 10v6c0 1.1.9 2 2 2h3"/>'

export const gridIcons: Record<string, () => string> = {
  // column header column-menu button (kebab)
  menu: () => ICON(KEBAB),
  menuAlt: () => ICON(KEBAB),
  columnMenu: () => ICON(KEBAB),
  columnsMenu: () => ICON(COLUMNS),
  // filter funnel (header filter button + floating filter)
  filter: () => ICON(FUNNEL),
  setFilter: () => ICON(FUNNEL),
  filterActive: () => ICON(FUNNEL),
  // sort indicators
  sortAscending: () => ICON(ARROW_UP),
  sortDescending: () => ICON(ARROW_DOWN),
  sortUnSort: () => ICON(CHEVRONS_UP_DOWN),
  // row-group expand / contract (in the auto-group cell)
  groupExpanded: () => ICON(CHEVRON_DOWN),
  groupContracted: () => ICON(CHEVRON_RIGHT),
  // tool-panel + filter tree expand / collapse
  columnSelectOpen: () => ICON(CHEVRON_DOWN),
  columnSelectClosed: () => ICON(CHEVRON_RIGHT),
  treeOpen: () => ICON(CHEVRON_DOWN),
  treeClosed: () => ICON(CHEVRON_RIGHT),
  accordionOpen: () => ICON(CHEVRON_DOWN),
  accordionClosed: () => ICON(CHEVRON_RIGHT),
  // sidebar tab + columns concepts
  columns: () => ICON(COLUMNS),
  // row-group panel leading glyph (the "group by" decorator)
  group: () => ICON(LIST_TREE),
  // checkboxes / ticks / closes used across menus + tool panels
  check: () => ICON(CHECK),
  tick: () => ICON(CHECK),
  checkboxChecked: () => ICON(CHECK),
  cancel: () => ICON(X),
  cross: () => ICON(X),
  close: () => ICON(X),
  // column drag affordances (row-group panel pill grip, drop hints)
  grip: () => ICON(GRIP),
  columnMoveMove: () => ICON(GRIP),
  columnMovePin: () => ICON(PIN),
  columnMoveHide: () => ICON(EYE_OFF),
  columnMoveLeft: () => ICON(CHEVRON_LEFT),
  columnMoveRight: () => ICON(CHEVRON_RIGHT),
  // generic small carets (dropdowns / aggregation pickers)
  smallDown: () => ICON(CHEVRON_DOWN),
  smallLeft: () => ICON(CHEVRON_LEFT),
  smallRight: () => ICON(CHEVRON_RIGHT),
  smallUp: () => ICON(ARROW_UP),
  // pagination
  first: () => ICON(CHEVRONS_LEFT),
  previous: () => ICON(CHEVRON_LEFT),
  next: () => ICON(CHEVRON_RIGHT),
  last: () => ICON(CHEVRONS_RIGHT),
  // auto-size / fit affordances surfaced in menus
  arrows: () => ICON(ARROW_LR),
}
