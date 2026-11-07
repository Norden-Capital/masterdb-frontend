import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { nextDelay, percent } from "./poll.ts"

describe("nextDelay", () => {
  it("uses the interval while calls succeed", () => {
    assert.equal(nextDelay(2000, 0), 2000)
  })

  it("doubles per failure in a row and stops at the cap", () => {
    assert.deepEqual([1, 2, 3, 4].map((n) => nextDelay(2000, n)), [4000, 8000, 16000, 32000])
    assert.equal(nextDelay(2000, 5), 60000)
    assert.equal(nextDelay(2000, 500), 60000)
    assert.equal(nextDelay(2000, 3, 10000), 10000)
  })
})

describe("percent", () => {
  it("rounds down, so 99.9 % is not shown as finished", () => {
    assert.equal(percent(999, 1000), 99)
    assert.equal(percent(1000, 1000), 100)
    assert.equal(percent(0, 5), 0)
  })

  it("is unknown without a real total", () => {
    assert.equal(percent(5, 0), null)
    assert.equal(percent(5, null), null)
    assert.equal(percent(null, 10), null)
    assert.equal(percent(Number.NaN, 10), null)
  })

  it("never leaves 0..100 even if the server's numbers disagree", () => {
    assert.equal(percent(12, 10), 100)
    assert.equal(percent(-1, 10), 0)
  })
})
