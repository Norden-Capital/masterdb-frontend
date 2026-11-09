/**
 * List management helpers, free of React so `npm test` can check them:
 * the API shapes, status labels, and the chunked upload loop.
 */

import type { Category } from "./types.ts"

export type ListStatus = "UPLOADING" | "DOWNLOADING" | "MAPPING" | "QUEUED" | "IMPORTING" | "READY" | "FAILED"
export type ListSource = "FILE" | "DRIVE"

export type RunningJob = { publicId: string; status: string; total: number; checked: number }

/** GET /api/v1/lists items and the list of GET /api/v1/lists/{id}. */
export type ListItem = {
  publicId: string
  name: string
  esp: string
  country: string
  vertical: string
  removeDuplicates: boolean
  splitSize: number
  source: ListSource
  sourceName: string
  status: ListStatus
  message?: string
  records: number
  parts: number
  upload: { size?: number; received: number }
  /** phase READING (bytes of the file) or SAVING (rows) while importing; QUEUED before. */
  progress?: { phase: string; done: number; total: number }
  report?: { totalLines: number; imported: number; invalid: number; duplicates: number; duplicatesRemoved: boolean; inOtherLists: number }
  mapping?: { delimiter: string; hasHeader: boolean; emailColumn: number; columns: string[] }
  validation?: { counts?: Partial<Record<Category, number>>; at?: string; running?: RunningJob }
  createdBy?: string
  createdAt: string
  importedAt?: string
}

export type ListPart = { publicId: string; partNo: number; records: number; firstSeq: number; lastSeq: number; running?: RunningJob }

export type ListDetail = { list: ListItem; parts: ListPart[] }

export type ListMember = { seq: number; partNo: number; email: string; fields?: string[] }

export type ListPreview = {
  delimiter: string
  hasHeader: boolean
  emailColumn: number
  columns: string[]
  rows: string[][]
  emailsPerColumn: number[]
}

export type ListFacets = { esp: string[]; country: string[]; vertical: string[] }

/** What the server has of an upload (PUT/GET …/upload). */
export type UploadState = { publicId: string; status: ListStatus; received: number; size?: number; message?: string }

/** Under Vercel's 4.5 MB request limit, with room for headers. */
export const CHUNK_SIZE = 3 * 1024 * 1024

const STATUS: Record<ListStatus, { label: string; tone: "blue" | "amber" | "green" | "red" | "grey" }> = {
  UPLOADING: { label: "Uploading", tone: "blue" },
  DOWNLOADING: { label: "Downloading", tone: "blue" },
  MAPPING: { label: "Choose the column", tone: "amber" },
  QUEUED: { label: "Waiting to import", tone: "blue" },
  IMPORTING: { label: "Importing", tone: "blue" },
  READY: { label: "Ready", tone: "green" },
  FAILED: { label: "Failed", tone: "red" },
}

export function listStatus(s: ListStatus): { label: string; tone: "blue" | "amber" | "green" | "red" | "grey" } {
  return STATUS[s] ?? { label: s, tone: "grey" }
}

/** The server still works on it in the background (poll it). */
export function isBusy(s: ListStatus): boolean {
  return s === "DOWNLOADING" || s === "QUEUED" || s === "IMPORTING"
}

/** "1.4 MB", "820 KB", "2 GB" (1024-based, like the server's messages). */
export function bytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—"
  if (n >= 1024 ** 3) return `${trim(n / 1024 ** 3)} GB`
  if (n >= 1024 ** 2) return `${trim(n / 1024 ** 2)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

function trim(v: number): string {
  return v >= 100 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, "")
}

/** .txt or .csv, as the server takes (the old app took no .zip either). */
export function isListFile(name: string): boolean {
  return /\.(txt|csv)$/i.test(name.trim())
}

/** A light check before sending (the server decides): an https Google Drive or Docs link. */
export function driveLinkProblem(link: string): string | null {
  const v = link.trim()
  if (!v) return "Paste the Google Drive link."
  let url: URL
  try {
    url = new URL(v)
  } catch {
    return "This is not a link."
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "The link must start with https://"
  if (url.hostname !== "drive.google.com" && url.hostname !== "docs.google.com") {
    return "Only Google Drive links (drive.google.com or docs.google.com)."
  }
  if (url.pathname.includes("/folders/")) return "This is a folder: share the file itself."
  return null
}

/** The separator as people say it. */
export function delimiterLabel(d?: string): string {
  switch (d) {
    case ",": return "Comma"
    case ";": return "Semicolon"
    case "TAB": return "Tab"
    case "|": return "Pipe"
    default: return "One column"
  }
}

/** The latest results' total (each address once). */
export function validatedCount(counts?: Partial<Record<Category, number>>): number {
  if (!counts) return 0
  return Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)
}

/** Sends one chunk; resolves with what the server now has. */
export type PutChunk = (offset: number, chunk: Blob, signal?: AbortSignal) => Promise<UploadState>

/** A chunk refused because the server stands elsewhere: go on from `received`. */
export class OffsetMismatch extends Error {
  readonly received: number

  constructor(received: number) {
    super("offset mismatch")
    this.received = received
  }
}

/**
 * Sends `file` from byte `from` on, one chunk after the other. Progress is
 * only ever what the server answered it has (`received`), never what was
 * handed to the browser. A failed chunk is retried up to `retries` times
 * (waiting longer each time); a 409 offset answer moves to the server's
 * position. Resolves with the last state (status MAPPING once complete).
 */
export async function sendFile(opts: {
  file: Blob
  from: number
  put: PutChunk
  onProgress: (state: UploadState) => void
  chunkSize?: number
  retries?: number
  signal?: AbortSignal
  wait?: (ms: number) => Promise<void>
}): Promise<UploadState | null> {
  const size = opts.file.size
  const chunk = opts.chunkSize ?? CHUNK_SIZE
  const retries = opts.retries ?? 5
  const wait = opts.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  let offset = opts.from
  let last: UploadState | null = null
  let failures = 0
  while (offset < size) {
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError")
    const piece = opts.file.slice(offset, Math.min(size, offset + chunk))
    try {
      last = await opts.put(offset, piece, opts.signal)
      failures = 0
      if (last.received <= offset && last.received < size) throw new Error("The server did not take the chunk.")
      offset = last.received
      opts.onProgress(last)
    } catch (e) {
      if (e instanceof OffsetMismatch) {
        offset = e.received
        continue
      }
      if ((e as Error)?.name === "AbortError") throw e
      // A refusal (permission, too big, list gone…) won't change by trying again.
      const status = (e as { status?: number })?.status
      if (status && status >= 400 && status < 500) throw e
      failures++
      if (failures > retries) throw e
      await wait(Math.min(30_000, 1000 * 2 ** (failures - 1)))
    }
  }
  return last
}

/** The real chunk sender: PUT /api/v1/lists/{id}/upload?offset=N through the site's /api proxy. */
export function putChunkFor(listId: string, onError: (status: number, body: Record<string, unknown>, requestId: string | null) => Error): PutChunk {
  return async (offset, chunk, signal) => {
    const res = await fetch(`/api/v1/lists/${listId}/upload?offset=${offset}`, {
      method: "PUT", body: chunk, headers: { "Content-Type": "application/octet-stream" },
      credentials: "same-origin", cache: "no-store", signal,
    })
    const text = await res.text()
    let body: Record<string, unknown> = {}
    try {
      body = text ? JSON.parse(text) : {}
    } catch {
      body = {}
    }
    if (res.ok) return body as unknown as UploadState
    if (res.status === 409 && body.code === "UPLOAD_OFFSET_MISMATCH" && typeof body.received === "number") {
      throw new OffsetMismatch(body.received)
    }
    throw onError(res.status, body, res.headers.get("X-Request-Id"))
  }
}
