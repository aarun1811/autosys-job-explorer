/**
 * Split a label into the typed-prefix `head` and the remaining `tail`, so the
 * dropdown can render `head` in normal weight and `tail` bold (Google style).
 * `head` is non-empty only when `text` case-insensitively starts with the
 * trimmed query; the head preserves `text`'s original casing.
 */
export function splitOnPrefix(text: string, query: string): { head: string; tail: string } {
  const q = query.trim()
  if (q && text.toLowerCase().startsWith(q.toLowerCase())) {
    return { head: text.slice(0, q.length), tail: text.slice(q.length) }
  }
  return { head: '', tail: text }
}
