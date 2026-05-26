/**
 * Derive display initials from a Citi loginId — Angular `getUserInitials` parity
 * (search-v5.component.ts). Dotted ids (`john.doe`) use the first char of the
 * first two parts (`JD`); otherwise the first two characters, upper-cased.
 */
export function userInitials(loginId: string): string {
  if (!loginId) return ''
  const parts = loginId.split('.')
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return loginId.substring(0, 2).toUpperCase()
}
