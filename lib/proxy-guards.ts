/**
 * Checks the API proxy (app/api/[...path]/route.ts) makes before forwarding a
 * request to the backend. Plain functions with no Next.js or server imports,
 * so `npm test` can run them directly (lib/proxy-guards.test.ts).
 */

/** Methods that never change anything; everything else is a write. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

/** Allowed in development only: the `next dev` server. */
export const DEV_ORIGIN = "http://localhost:3000"

/**
 * CSRF guard for the session cookie: is this write really from our own pages?
 *
 * The cookie is SameSite=Lax, which already keeps it off cross-site POSTs in
 * current browsers. This is the second lock, and the backend relies on it
 * (it never sees the browser's Origin: the proxy drops it).
 *
 * - GET/HEAD/OPTIONS: allowed (they must not change anything).
 * - `Origin` present: must be this site's own origin (`allowedOrigins`).
 *   `Origin: null` (sandboxed frames, some redirects) is refused.
 * - `Sec-Fetch-Site` present: must be `same-origin` (`same-site` would let
 *   another *.nordencapital.ca site in).
 * - Neither header: allowed. Browsers send at least one of them on every
 *   cross-origin write, so such a request is not a browser riding the user's
 *   cookie (it is curl, a script, a server), and CSRF needs a browser.
 */
export function isSameOriginWrite(method: string, headers: Headers, allowedOrigins: readonly string[]): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true

  const origin = headers.get("origin")
  if (origin !== null && !allowedOrigins.includes(origin)) return false

  const fetchSite = headers.get("sec-fetch-site")
  if (fetchSite !== null && fetchSite !== "same-origin") return false

  return true
}

/**
 * This site's own origin(s) for `isSameOriginWrite`: the origin of the
 * request URL and of the Host / X-Forwarded-Host header the platform passed
 * (they agree on Vercel; behind other proxies the URL can be internal), plus
 * `http://localhost:3000` outside production.
 */
export function ownOrigins(requestUrl: string, headers: Headers, development: boolean): string[] {
  const origins = new Set<string>()
  origins.add(new URL(requestUrl).origin)
  const host = headers.get("x-forwarded-host") ?? headers.get("host")
  if (host) {
    const proto = headers.get("x-forwarded-proto") ?? new URL(requestUrl).protocol.replace(":", "")
    origins.add(`${proto}://${host}`)
  }
  if (development) origins.add(DEV_ORIGIN)
  return [...origins]
}

/** An IPv4 or IPv6 address and nothing else (same rule as the backend's ClientIp). */
const ADDRESS = /^[0-9A-Fa-f:.]{2,45}$/

/**
 * The visitor's IP address for the backend's `X-Client-IP`, or null.
 *
 * Only on Vercel (`onVercel`), where the platform sets `x-real-ip` and
 * `x-forwarded-for` itself and overwrites whatever the client sent, so they
 * cannot be forged. Anywhere else these headers may come straight from the
 * caller, so nothing is forwarded and the backend uses the connection's
 * address. The backend believes `X-Client-IP` only together with the proxy
 * secret.
 */
export function clientIp(headers: Headers, onVercel: boolean): string | null {
  if (!onVercel) return null
  const candidate = headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return candidate && ADDRESS.test(candidate) ? candidate : null
}
