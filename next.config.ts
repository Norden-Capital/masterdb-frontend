import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Safety headers on every page (same set as LMS). Framing is allowed for this
// site only ('self'), so no other site can show these pages inside its own.
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Files named page.dev.tsx / route.dev.ts exist only under `next dev`
// (/dev/components and its demo endpoints): a production build does not
// contain them at all, so those paths are a plain 404 there.
const DEV_ONLY = ["dev.tsx", "dev.ts"];
const EXTENSIONS = ["tsx", "ts", "jsx", "js"];

const nextConfig = (phase: string): NextConfig => ({
  pageExtensions: phase === PHASE_DEVELOPMENT_SERVER ? [...DEV_ONLY, ...EXTENSIONS] : EXTENSIONS,
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
  // No rewrites: /api/* is forwarded to the backend by the Route Handler in
  // app/api/[...path]/route.ts, which adds the proxy secret the backend
  // requires (a rewrite cannot add request headers). It reads BACKEND_URL and
  // PROXY_SECRET at request time, server-side only.
});

export default nextConfig;
