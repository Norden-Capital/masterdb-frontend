import "server-only"

/**
 * The one way this app talks to the backend API, from the server only.
 *
 * The backend answers only requests that carry `X-Proxy-Secret` with the
 * value of `PROXY_SECRET` (a Vercel environment variable here, a GitHub secret
 * on the backend). `import "server-only"` makes the build fail if a client
 * component ever imports this file, so the secret cannot reach the browser.
 * Never give it a `NEXT_PUBLIC_` name: those are copied into the browser bundle.
 */

export const PROXY_SECRET_HEADER = "X-Proxy-Secret"

export type BackendConfig = { url: string; secret: string }

/**
 * `BACKEND_URL` and `PROXY_SECRET`, or null when either is missing (the caller
 * answers "backend unavailable"). Trimmed: a pasted value with a trailing
 * newline must still match.
 */
export function backendConfig(): BackendConfig | null {
  const url = process.env.BACKEND_URL?.trim().replace(/\/+$/, "")
  const secret = process.env.PROXY_SECRET?.trim()
  if (!url || !secret) {
    // Says which one is missing, never what a value is.
    console.error(
      `[backend] ${!url ? "BACKEND_URL" : "PROXY_SECRET"} is not set — calls to the backend will fail. See .env.example.`
    )
    return null
  }
  return { url, secret }
}

/**
 * `fetch` against the backend: `path` starts with `/api/...`. Adds the proxy
 * secret; everything else in `init` is passed through unchanged. Throws if the
 * configuration is missing, like a network error would.
 */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const config = backendConfig()
  if (!config) throw new Error("Backend is not configured")
  const headers = new Headers(init.headers)
  headers.set(PROXY_SECRET_HEADER, config.secret)
  return fetch(`${config.url}${path}`, { ...init, headers })
}
