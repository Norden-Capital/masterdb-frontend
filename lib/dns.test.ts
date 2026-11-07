import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { daysUntil, expiryInfo, importable, normalizeDomain } from "./dns.ts"

describe("normalizeDomain", () => {
  it("trims, lowercases and drops the trailing dot", () => {
    assert.equal(normalizeDomain("  Example.COM. "), "example.com")
    assert.equal(normalizeDomain("mail.example.co.uk"), "mail.example.co.uk")
    assert.equal(normalizeDomain("xn--bcher-kva.de"), "xn--bcher-kva.de")
  })

  it("refuses urls, emails and broken names", () => {
    for (const bad of ["http://example.com", "example.com/x", "a@b.com", "nodot", "-a.com", "a..com", "", "a b.com"]) {
      assert.equal(normalizeDomain(bad), null, bad)
    }
  })

  it("leaves international names to the backend", () => {
    assert.equal(normalizeDomain("Bücher.de"), "bücher.de")
  })
})

describe("expiry", () => {
  const today = new Date("2026-11-07T23:30:00Z")
  it("counts whole days in UTC", () => {
    assert.equal(daysUntil("2026-11-08", today), 1)
    assert.equal(daysUntil("2026-11-06", today), -1)
  })

  it("reads expired, soon, later and unknown", () => {
    assert.deepEqual(expiryInfo({}, today), { label: "Unknown", tone: "grey" })
    assert.equal(expiryInfo({ expiresAt: "2026-06-01", expired: true }, today).tone, "red")
    assert.equal(expiryInfo({ expiresAt: "2026-11-01" }, today).tone, "red")
    assert.deepEqual(expiryInfo({ expiresAt: "2026-11-20" }, today), { label: "2026-11-20 · in 13 days", tone: "amber" })
    assert.equal(expiryInfo({ expiresAt: "2027-02-15" }, today).tone, "green")
  })
})

describe("importable", () => {
  it("skips names already in MasterDB", () => {
    assert.deepEqual(importable([{ name: "a.com", alreadyAdded: true }, { name: "b.com", alreadyAdded: false }]), ["b.com"])
  })
})

import { changeCounts, dkimKey, recordLine } from "./dns.ts"

describe("records", () => {
  it("prints a record on one line", () => {
    assert.equal(recordLine({ name: "@", type: "MX", address: "mail.example.com.", mxPref: "10" }), "@ MX 10 mail.example.com.")
    assert.equal(recordLine({ name: "_dmarc", type: "TXT", address: "v=DMARC1; p=quarantine", mxPref: "10" }), "_dmarc TXT v=DMARC1; p=quarantine")
  })

  it("counts changes", () => {
    assert.deepEqual(changeCounts([{ change: "ADD" }, { change: "KEEP" }, { change: "KEEP" }, { change: "REMOVE" }]),
      { add: 1, remove: 1, keep: 2 })
  })

  it("takes the key out of a pasted DKIM record", () => {
    assert.equal(dkimKey('"v=DKIM1; k=rsa; p=MIIB IjAN\nBgkq"'), "MIIBIjANBgkq")
    assert.equal(dkimKey(" MIIBIjANBgkq "), "MIIBIjANBgkq")
  })
})
