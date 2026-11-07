/**
 * Dev-only stand-in for a job progress endpoint, for /dev/components. The
 * numbers are computed here on the server from the start time the page sends
 * (no state kept), so the page polls a real HTTP answer exactly as it will
 * poll a real job. `fail=1` makes every other 4-second window answer 503 to
 * show the back-off. Production builds answer 404.
 */
export async function GET(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 })
  const url = new URL(request.url)
  const started = Number(url.searchParams.get("started"))
  const total = Math.min(1_000_000, Math.max(1, Number(url.searchParams.get("total")) || 2400))
  if (!Number.isFinite(started) || started <= 0) {
    return Response.json({ code: "BAD_REQUEST", detail: "started is required" }, { status: 400 })
  }
  const elapsed = Math.max(0, Date.now() - started)
  if (url.searchParams.get("fail") === "1" && Math.floor(elapsed / 4000) % 2 === 1) {
    return Response.json({ code: "SERVICE_UNAVAILABLE", detail: "Demo outage" }, { status: 503 })
  }
  const done = Math.min(total, Math.floor((elapsed / 1000) * (total / 30))) // about 30 s for the whole job
  const invalid = Math.floor(done * 0.12)
  const unknown = Math.floor(done * 0.07)
  return Response.json({
    state: done >= total ? "FINISHED" : "RUNNING",
    total, done, valid: done - invalid - unknown, invalid, unknown,
  }, { headers: { "Cache-Control": "no-store" } })
}
