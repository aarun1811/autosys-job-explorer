export interface SuggestItem {
  type: 'recent' | 'suggestion'
  text: string
}

const MAX_EMPTY_RECENTS = 8
const MAX_TYPING_RECENTS = 3
const MAX_TOTAL = 10

/**
 * Build the unified dropdown list (Google-style): when the query is empty, the
 * most-recent searches only; while typing, recents whose text starts with the
 * query (case-insensitive, newest-first, capped) followed by live suggestions,
 * deduped case-insensitively (a recent that is also a suggestion appears once,
 * as a recent). Pure — no React, no I/O.
 */
export function buildSuggestItems(
  recents: string[],
  suggestions: string[],
  query: string,
): SuggestItem[] {
  const q = query.trim()
  if (q === '') {
    return recents.slice(0, MAX_EMPTY_RECENTS).map((text) => ({ type: 'recent' as const, text }))
  }
  const ql = q.toLowerCase()
  const matchedRecents = recents
    .filter((r) => r.toLowerCase().startsWith(ql))
    .slice(0, MAX_TYPING_RECENTS)
  const seen = new Set(matchedRecents.map((r) => r.toLowerCase()))
  const items: SuggestItem[] = matchedRecents.map((text) => ({ type: 'recent', text }))
  for (const s of suggestions) {
    if (items.length >= MAX_TOTAL) break
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    items.push({ type: 'suggestion', text: s })
  }
  return items
}
