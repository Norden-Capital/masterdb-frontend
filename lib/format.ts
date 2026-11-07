/** Display helpers: dates in the viewer's time zone, initials, devices. */

const TIME = new Intl.DateTimeFormat("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false })
const TIME_S = new Intl.DateTimeFormat("en-CA", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" })
const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" })

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** "Today", "Yesterday" or "4 Nov". */
export function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(d, now)) return "Today"
  if (sameDay(d, yesterday)) return "Yesterday"
  return DAY.format(d)
}

/** "Today, 09:12", "3 Nov, 14:22". */
export function when(iso?: string | null): string {
  if (!iso) return "Never"
  return `${dayLabel(iso)}, ${TIME.format(new Date(iso))}`
}

export function timeWithSeconds(iso: string): string {
  return TIME_S.format(new Date(iso))
}

export function date(iso?: string | null): string {
  return iso ? DATE.format(new Date(iso)) : "—"
}

/** "in 3 days", "2 days ago". */
export function relative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  const abs = Math.abs(diff)
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute")
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour")
  return rtf.format(Math.round(diff / 86_400_000), "day")
}

export function initials(name: string): string {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

/** Stable avatar colour class from an id (the mock's a–e). */
export function avatarTone(id: string): string {
  const tones = ["", "b", "c", "d", "e"]
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return tones[h % tones.length]
}

/** "Chrome · Windows" from a User-Agent. */
export function device(ua?: string | null): { label: string; kind: "phone" | "laptop" | "desktop" } {
  if (!ua) return { label: "Unknown device", kind: "desktop" }
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari" : /curl\//i.test(ua) ? "curl" : "Browser"
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows"
    : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : ""
  const kind = /iPhone|Android|Mobile/.test(ua) ? "phone" : os === "macOS" ? "laptop" : "desktop"
  return { label: os ? `${browser} · ${os}` : browser, kind }
}
