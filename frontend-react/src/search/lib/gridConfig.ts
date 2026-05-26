// src/search/lib/gridConfig.ts

/** Row-height presets for the density toggle. */
export type GridDensity = 'normal' | 'compact'

export function rowHeightForDensity(density: GridDensity): number {
  return density === 'compact' ? 28 : 36
}
