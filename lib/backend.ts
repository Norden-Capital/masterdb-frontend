import "server-only"

/**
 * The one way this app talks to the backend API, from the server only.
 * `import "server-only"` makes the build fail if a client component ever
 * imports this file, so the backend address stays on the server.
 */

export type BackendConfig = { url: string }

/**
 * `BACKEND_URL`, or null when it is missing (the caller answers "backend
 * unavailable"). Trimmed: a pasted value with a trailing newline must still work.
 */
export function backendConfig(): BackendConfig | null {
  const url = process.env.BACKEND_URL?.trim().replace(/\/+$/, "")
  if (!url) {
    console.error("[backend] BACKEND_URL is not set — calls to the backend will fail. See .env.example.")
    return null
  }
  return { url }
}

/**
 * `fetch` against the backend: `path` starts with `/api/...`; `init` is passed
 * through unchanged. Throws if the configuration is missing, like a network
 * error would.
 */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const config = backendConfig()
  if (!config) throw new Error("Backend is not configured")
  return fetch(`${config.url}${path}`, init)
}
