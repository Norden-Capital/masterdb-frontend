/**
 * Browser-side calls to our own `/api/...` (the same-origin proxy in
 * app/api/[...path]/route.ts forwards them to the backend). The session lives
 * in the HttpOnly `md_session` cookie: no token is ever handled here.
 *
 * Every error from the backend is problem+json with a stable `code`
 * (backend README, "Errors"); `ApiError` carries it so pages can switch on it.
 */

export type FieldError = { field: string; message: string }

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail: string,
    readonly fields: FieldError[] = [],
    readonly retryAfter: number | null = null,
    readonly requestId: string | null = null,
  ) {
    super(detail)
  }

  /** The message for a field, if the backend named it. */
  field(name: string): string | undefined {
    return this.fields.find((f) => f.field === name)?.message
  }
}

/** Sent when any call answers 401 UNAUTHENTICATED: the session is gone. */
export const SESSION_LOST_EVENT = "md:session-lost"

type Options = { method?: string; body?: unknown; signal?: AbortSignal }

export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal,
    })
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e
    throw new ApiError(0, "NETWORK", "The server cannot be reached. Check your connection and try again.")
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const json = text ? safeJson(text) : null
  if (res.ok) return json as T

  const body = (json ?? {}) as { code?: string; detail?: string; errors?: FieldError[]; requestId?: string;
    retryAfterSeconds?: number }
  const retryHeader = Number(res.headers.get("Retry-After"))
  const error = new ApiError(
    res.status,
    body.code ?? (res.status >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST"),
    body.detail ?? "Something went wrong. Try again.",
    body.errors ?? [],
    body.retryAfterSeconds ?? (Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : null),
    body.requestId ?? res.headers.get("X-Request-Id"),
  )
  if (error.code === "UNAUTHENTICATED" && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_LOST_EVENT))
  }
  throw error
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** A sentence for any error, for banners and toasts. */
export function describe(error: unknown): string {
  if (!(error instanceof ApiError)) return "Something went wrong. Try again."
  switch (error.code) {
    case "NETWORK":
    case "SERVICE_UNAVAILABLE":
      return "The MasterDB server cannot be reached right now. Try again in a moment."
    case "RATE_LIMITED":
      return `Too many attempts from your network. Try again in ${wait(error.retryAfter)}.`
    case "FORBIDDEN":
      return error.detail || "You don't have permission to do this."
    case "INTERNAL_ERROR":
      return `Something went wrong on our side.${error.requestId ? ` Reference: ${error.requestId}.` : ""}`
    default:
      return error.detail
  }
}

/** "45 seconds", "3 minutes". */
export function wait(seconds: number | null): string {
  if (!seconds || seconds < 60) return `${seconds ?? 60} seconds`
  const m = Math.ceil(seconds / 60)
  return `${m} minute${m === 1 ? "" : "s"}`
}
