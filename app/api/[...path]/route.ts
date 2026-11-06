import { PROXY_SECRET_HEADER, backendConfig } from "@/lib/backend"

/**
 * Same-origin proxy: the browser calls `/api/...` on this site, and this
 * handler forwards it to the backend from the server, adding the proxy secret
 * the backend requires (see lib/backend.ts). The backend address and the
 * secret never reach the browser.
 *
 * Why a Route Handler and not `next.config.ts` rewrites or `proxy.ts`:
 * - rewrites cannot add request headers, so the secret could not be sent.
 * - `proxy.ts` (`NextResponse.rewrite(url, { request: { headers } })`) can,
 *   but it buffers request bodies in memory and silently cuts them at 10 MB
 *   (`proxyClientMaxBodySize`), runs on every route, and is where the login
 *   redirects of M1 belong (as in the LMS's middleware).
 * - Here both bodies are streamed, and every header in and out is decided in
 *   one readable place.
 *
 * Passed through intact: method, path, query string, body, status code,
 * `Set-Cookie` (each cookie separately), `X-Request-Id` both ways, redirects
 * (not followed: the browser sees them). Known limit: Vercel caps a function's
 * request body at 4.5 MB, so large uploads (contact imports) will need their
 * own route later.
 */

/** Never forwarded to the backend. */
const DROP_REQUEST = new Set([
  // Hop-by-hop: they describe this connection, not the request.
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  // fetch sets these itself for the new connection.
  "host",
  "content-length",
  // Let fetch negotiate compression it can decode (see DROP_RESPONSE).
  "accept-encoding",
  // A caller cannot bring their own: ours is set below.
  "x-proxy-secret",
  // Same-origin from the browser's point of view; to the backend this is a
  // server-to-server call proven by the secret, not a CORS request. Keeping it
  // would make the backend's CORS refuse Vercel preview deployments and local
  // `next dev` (http://localhost:3000) calling the live API.
  "origin",
])

/** Prefixes of platform headers the backend has no use for (some carry tokens). */
const DROP_REQUEST_PREFIXES = ["x-vercel-", "x-middleware-", "x-invoke-", "x-nextjs-", "next-router-"]

/** Never returned to the browser. */
const DROP_RESPONSE = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  // fetch has already decompressed the body, so these would describe bytes
  // that are no longer there. The platform compresses and frames it again.
  "content-encoding",
  "content-length",
  // Re-added one cookie at a time below.
  "set-cookie",
])

const SAFE_REQUEST_ID = /^[A-Za-z0-9-]{1,64}$/

function forwardHeaders(incoming: Headers, secret: string): Headers {
  const out = new Headers()
  incoming.forEach((value, name) => {
    const key = name.toLowerCase()
    if (DROP_REQUEST.has(key) || DROP_REQUEST_PREFIXES.some((p) => key.startsWith(p))) return
    out.append(name, value)
  })
  out.set(PROXY_SECRET_HEADER, secret)
  return out
}

function responseHeaders(upstream: Headers): Headers {
  const out = new Headers()
  upstream.forEach((value, name) => {
    if (!DROP_RESPONSE.has(name.toLowerCase())) out.append(name, value)
  })
  // Several cookies must stay several headers: joining them breaks them.
  for (const cookie of upstream.getSetCookie()) out.append("set-cookie", cookie)
  return out
}

/** The backend could not be reached: same problem+json shape as its own errors. */
function unavailable(request: Request, path: string): Response {
  const incoming = request.headers.get("x-request-id")
  const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID()
  const body = {
    type: "about:blank",
    title: "Service Unavailable",
    status: 503,
    detail: "The MasterDB server cannot be reached right now. Try again in a moment.",
    instance: path,
    code: "SERVICE_UNAVAILABLE",
    timestamp: new Date().toISOString(),
    requestId,
  }
  return Response.json(body, {
    status: 503,
    headers: { "Content-Type": "application/problem+json", "X-Request-Id": requestId },
  })
}

async function forward(request: Request): Promise<Response> {
  // The raw path and query, exactly as the browser sent them (still encoded).
  const { pathname, search } = new URL(request.url)
  const config = backendConfig()
  if (!config) return unavailable(request, pathname)

  const hasBody = request.method !== "GET" && request.method !== "HEAD"
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers: forwardHeaders(request.headers, config.secret),
    body: hasBody ? request.body : undefined,
    // Required by fetch to send a streamed body.
    duplex: hasBody ? "half" : undefined,
    redirect: "manual",
    cache: "no-store",
    // The browser went away: stop the backend call too.
    signal: request.signal,
  }

  let upstream: Response
  try {
    upstream = await fetch(`${config.url}${pathname}${search}`, init)
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 })
    // The error's name only: messages can contain the URL.
    console.error(`[api proxy] ${request.method} ${pathname} failed: ${(error as Error)?.name ?? "error"}`)
    return unavailable(request, pathname)
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders(upstream.headers),
  })
}

export {
  forward as GET,
  forward as HEAD,
  forward as POST,
  forward as PUT,
  forward as PATCH,
  forward as DELETE,
}
