/**
 * Checks the API proxy (app/api/[...path]/route.ts) makes before forwarding a
 * request to the backend. Plain functions with no Next.js or server imports,
 * so `npm test` can run them directly (lib/proxy-guards.test.ts).
 */

/** An IPv4 or IPv6 address and nothing else (same rule as the backend's ClientIp). */
const ADDRESS = /^[0-9A-Fa-f:.]{2,45}$/

/**
 * The visitor's IP address for the backend's `X-Client-IP`, or null.
 *
 * Only on Vercel (`onVercel`), where the platform sets `x-real-ip` and
 * `x-forwarded-for` itself and overwrites whatever the client sent, so they
 * cannot be forged. Anywhere else these headers may come straight from the
 * caller, so nothing is forwarded and the backend uses the connection's
 * address.
 */
export function clientIp(headers: Headers, onVercel: boolean): string | null {
  if (!onVercel) return null
  const candidate = headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return candidate && ADDRESS.test(candidate) ? candidate : null
}
