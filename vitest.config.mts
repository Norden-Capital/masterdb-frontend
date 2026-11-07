import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

// Component and hook tests (jsdom). Pure logic in lib/*.test.ts runs on
// Node's own test runner; `npm test` runs both.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "jsdom",
    include: ["components/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
})
