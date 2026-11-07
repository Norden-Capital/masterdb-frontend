/**
 * Dev-only list endpoint in the backend's PageResponse format, for the data
 * table on /dev/components: page, size, sort (name|createdAt|rows, asc|desc),
 * q (name contains) and status. Made-up list names, no contact data.
 * Production builds answer 404.
 */
const STATUSES = ["READY", "VALIDATING", "DRAFT"] as const
const ROWS = Array.from({ length: 137 }, (_, i) => ({
  id: `demo-${i + 1}`,
  name: `Demo list ${String(i + 1).padStart(3, "0")}`,
  status: STATUSES[i % 3],
  rows: ((i * 7919) % 50_000) + 120,
  createdAt: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString(),
}))

export async function GET(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 })
  const p = new URL(request.url).searchParams
  const page = Math.max(0, Number(p.get("page")) || 0)
  const size = Math.min(100, Math.max(1, Number(p.get("size")) || 25))
  const [field, dir] = (p.get("sort") ?? "createdAt,asc").split(",")
  const q = (p.get("q") ?? "").toLowerCase()
  const status = p.get("status") ?? ""
  if (!["name", "createdAt", "rows"].includes(field)) {
    return Response.json({ code: "BAD_REQUEST", detail: `Can't sort by ${field}` }, { status: 400 })
  }
  const key = field as "name" | "createdAt" | "rows"
  const all = ROWS.filter((r) => r.name.toLowerCase().includes(q) && (!status || r.status === status))
    .sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (dir === "desc" ? -1 : 1))
  return Response.json({
    items: all.slice(page * size, page * size + size), page, size, totalItems: all.length,
    totalPages: Math.ceil(all.length / size),
  })
}
