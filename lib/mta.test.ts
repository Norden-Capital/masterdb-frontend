import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { dkimRecord, installStatus, isFinished, mergeLog } from "./mta.ts"

describe("install log", () => {
  it("appends only the new part, and starts over from a full answer", () => {
    let shown = { text: "", length: 0 }
    shown = mergeLog(shown, { log: "a\nb\n", logFrom: 0, logLength: 4 })
    assert.deepEqual(shown, { text: "a\nb\n", length: 4 })
    shown = mergeLog(shown, { log: "c\n", logFrom: 4, logLength: 6 })
    assert.deepEqual(shown, { text: "a\nb\nc\n", length: 6 })
    // Out of step: nothing appended, and the next call asks for the whole log.
    assert.deepEqual(mergeLog(shown, { log: "zz", logFrom: 2, logLength: 9 }), { text: shown.text, length: 0 })
  })
})

describe("install status", () => {
  it("knows when a job is over and how to name it", () => {
    assert.ok(isFinished("SUCCEEDED") && isFinished("FAILED") && isFinished("INTERRUPTED"))
    assert.ok(!isFinished("QUEUED") && !isFinished("RUNNING"))
    assert.deepEqual(installStatus("INTERRUPTED"), { label: "Interrupted", tone: "amber" })
    assert.equal(dkimRecord("MIIB"), "v=DKIM1; k=rsa; p=MIIB")
  })
})
