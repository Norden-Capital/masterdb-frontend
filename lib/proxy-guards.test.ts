// Run with `npm test` (Node's built-in test runner; Node strips the types itself).
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { clientIp } from "./proxy-guards.ts"

function headers(values: Record<string, string>): Headers {
  return new Headers(values)
}

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
