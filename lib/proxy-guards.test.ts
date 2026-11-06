// Run with `npm test` (Node's built-in test runner; Node strips the types itself).
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { DEV_ORIGIN, clientIp, isSameOriginWrite, ownOrigins } from "./proxy-guards.ts"

const SITE = "https://db.nordencapital.ca"
const ORIGINS = [SITE]

function headers(values: Record<string, string>): Headers {
  return new Headers(values)
}

describe("isSameOriginWrite", () => {
  it("allows reads whatever their origin", () => {
    for (const method of ["GET", "HEAD", "OPTIONS", "get"]) {
      assert.equal(isSameOriginWrite(method, headers({ origin: "https://evil.example" }), ORIGINS), true)
    }
  })

  it("allows a write from the site itself", () => {
    const h = headers({ origin: SITE, "sec-fetch-site": "same-origin" })
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.equal(isSameOriginWrite(method, h, ORIGINS), true)
    }
  })

  it("refuses a write from another site", () => {
    assert.equal(isSameOriginWrite("POST", headers({ origin: "https://evil.example" }), ORIGINS), false)
    assert.equal(isSameOriginWrite("DELETE", headers({ origin: "https://evil.example" }), ORIGINS), false)
  })

  it("refuses a sibling subdomain and other schemes or ports of the same host", () => {
    for (const origin of ["https://db-api.nordencapital.ca", "http://db.nordencapital.ca", `${SITE}:8443`]) {
      assert.equal(isSameOriginWrite("POST", headers({ origin }), ORIGINS), false, origin)
    }
  })

  it("refuses Origin: null", () => {
    assert.equal(isSameOriginWrite("POST", headers({ origin: "null" }), ORIGINS), false)
  })

  it("refuses by Sec-Fetch-Site when there is no Origin", () => {
    for (const site of ["cross-site", "same-site", "none"]) {
      assert.equal(isSameOriginWrite("POST", headers({ "sec-fetch-site": site }), ORIGINS), false, site)
    }
    assert.equal(isSameOriginWrite("POST", headers({ "sec-fetch-site": "same-origin" }), ORIGINS), true)
  })

  it("refuses when Origin matches but Sec-Fetch-Site does not", () => {
    const h = headers({ origin: SITE, "sec-fetch-site": "cross-site" })
    assert.equal(isSameOriginWrite("POST", h, ORIGINS), false)
  })

  it("allows a write without either header (not a browser: curl, a script)", () => {
    assert.equal(isSameOriginWrite("POST", headers({}), ORIGINS), true)
  })
})

describe("ownOrigins", () => {
  it("uses the request URL and the forwarded host", () => {
    const h = headers({ host: "internal:3000", "x-forwarded-host": "db.nordencapital.ca", "x-forwarded-proto": "https" })
    const origins = ownOrigins("http://internal:3000/api/v1/auth/login", h, false)
    assert.ok(origins.includes(SITE))
    assert.ok(origins.includes("http://internal:3000"))
    assert.ok(!origins.includes(DEV_ORIGIN))
  })

  it("adds the dev server only in development", () => {
    assert.ok(ownOrigins(`${SITE}/api/x`, headers({}), true).includes(DEV_ORIGIN))
    assert.ok(!ownOrigins(`${SITE}/api/x`, headers({}), false).includes(DEV_ORIGIN))
  })

  it("lets a Vercel preview call itself", () => {
    const preview = "https://masterdb-frontend-git-x.vercel.app"
    const origins = ownOrigins(`${preview}/api/v1/auth/login`, headers({ host: "masterdb-frontend-git-x.vercel.app" }), false)
    assert.equal(isSameOriginWrite("POST", headers({ origin: preview }), origins), true)
    assert.equal(isSameOriginWrite("POST", headers({ origin: SITE }), origins), false)
  })
})

describe("clientIp", () => {
  it("takes x-real-ip, then the first x-forwarded-for, on Vercel", () => {
    assert.equal(clientIp(headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }), true), "203.0.113.7")
    assert.equal(clientIp(headers({ "x-forwarded-for": "2001:db8::1, 10.0.0.1" }), true), "2001:db8::1")
  })

  it("forwards nothing off Vercel, where those headers can be forged", () => {
    assert.equal(clientIp(headers({ "x-real-ip": "203.0.113.7" }), false), null)
  })

  it("forwards nothing that is not an address", () => {
    assert.equal(clientIp(headers({ "x-real-ip": "<script>" }), true), null)
    assert.equal(clientIp(headers({ "x-real-ip": "1.2.3.4 5.6.7.8" }), true), null)
    assert.equal(clientIp(headers({}), true), null)
  })
})
