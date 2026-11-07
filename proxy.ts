import { NextResponse, type NextRequest } from "next/server"

/**
 * Optimistic route guard (Next 16 "proxy", formerly middleware): a page behind
 * the login without the `md_session` cookie goes straight to /login. It only
 * checks that the cookie exists; the backend decides whether it is valid
 * (an expired one makes /api/v1/auth/me answer 401 and the page sends the
 * person to /session-expired).
 *
 * The /api proxy, Next's own files and the public sign-in pages are excluded
 * by the matcher, so request bodies to /api are never buffered here.
 */
const PUBLIC = ["/login", "/forgot-password", "/reset-password", "/accept-invite", "/session-expired"]

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next()
  if (request.cookies.has("md_session")) return NextResponse.next()
  const login = new URL("/login", request.url)
  if (pathname !== "/") login.searchParams.set("next", pathname + search)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ["/((?!api/|_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
}
