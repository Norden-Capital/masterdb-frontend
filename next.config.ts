import type { NextConfig } from "next";

// Read once so a missing value fails visibly at startup rather than silently
// producing an `undefined/...` destination.
const BACKEND_URL = process.env.BACKEND_URL;

// Safety headers on every page (same set as LMS). Framing is allowed for this
// site only ('self'), so no other site can show these pages inside its own.
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Don't announce "Next.js" in every answer.
  poweredByHeader: false,
  headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  rewrites() {
    if (!BACKEND_URL) {
      console.warn(
        "[next.config] BACKEND_URL is not set — /api/* will 404. Copy .env.example to .env.local."
      );
      return [];
    }

    // Same-origin proxy (as in LMS): the browser only ever calls `/api/...` on
    // this app's own domain, and Next forwards it to the backend server-side.
    // Keeps the backend address out of the browser and avoids CORS entirely.
    //
    // Returning a plain array behaves as `afterFiles`, so any Route Handler
    // added later under `app/api/...` takes precedence over the proxy.
    //
    // `/api` has to be repeated in the destination: only the named parameter
    // is substituted, so `${BACKEND_URL}/:path*` would drop the prefix and 404.
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
