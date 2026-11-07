/**
 * Emailed links carry their token after `#` (`/reset-password#<token>`): the
 * browser never sends that part to a server, so it stays out of every access
 * log. Read it once, then remove it from the address bar and history.
 */
export function takeLinkToken(): string | null {
  const token = window.location.hash.slice(1)
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  window.history.replaceState(null, "", window.location.pathname)
  return token
}
