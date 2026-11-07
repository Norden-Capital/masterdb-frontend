import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { connectionInfo, serverExpiry, validIpv4, validUser } from "./servers.ts"

describe("serverExpiry", () => {
  it("warns within 14 days and when expired", () => {
    assert.deepEqual(serverExpiry({ expiresOn: "2026-11-01", daysLeft: -6 }), { label: "Expired 2026-11-01", tone: "red", warn: true })
    assert.equal(serverExpiry({ expiresOn: "2026-11-07", daysLeft: 0 }).tone, "red")
    assert.deepEqual(serverExpiry({ expiresOn: "2026-11-08", daysLeft: 1 }), { label: "2026-11-08 · in 1 day", tone: "amber", warn: true })
    assert.equal(serverExpiry({ expiresOn: "2026-11-21", daysLeft: 14 }).warn, true)
    assert.deepEqual(serverExpiry({ expiresOn: "2026-11-22", daysLeft: 15 }), { label: "2026-11-22", tone: "green", warn: false })
  })
})

describe("connectionInfo", () => {
  it("names every state, a changed key in red", () => {
    assert.deepEqual(connectionInfo("KEY_CHANGED"), { label: "Blocked: key changed", tone: "red" })
    assert.equal(connectionInfo("CONNECTED").tone, "green")
    assert.equal(connectionInfo("KEY_PENDING").label, "Key to check")
  })
})

describe("form checks", () => {
  it("accepts linux users and dotted IPv4", () => {
    assert.ok(validUser("root") && validUser("deploy_1") && !validUser("Root") && !validUser("a b"))
    assert.ok(validIpv4("147.93.4.107") && validIpv4(" 1.2.3.4 ") && !validIpv4("256.1.1.1") && !validIpv4("1.2.3"))
  })
})
