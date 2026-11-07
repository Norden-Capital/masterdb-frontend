import assert from "node:assert/strict"
import { test } from "node:test"

import { CATEGORIES, categoryMeta, duration, jobCounts, jobStatus, lineCount, looksLikeEmail, ringSegments, serverState } from "./validation.ts"

test("six categories in the fixed order, each with a pill tone", () => {
  assert.deepEqual(CATEGORIES, ["VALID", "BOUNCE", "SOFT_BOUNCE", "REJECT", "CATCH_ALL", "UNKNOWN"])
  assert.deepEqual(CATEGORIES.map((c) => categoryMeta(c).tone), ["green", "red", "amber", "purple", "teal", "grey"])
  assert.match(categoryMeta("UNKNOWN").meaning, /never counted as a bounce/)
})

test("light email check", () => {
  assert.ok(looksLikeEmail(" jane@example.com "))
  assert.ok(!looksLikeEmail("jane"))
  assert.ok(!looksLikeEmail("jane @example.com"))
  assert.ok(!looksLikeEmail("jane@example"))
})

test("duration", () => {
  assert.equal(duration(850), "850 ms")
  assert.equal(duration(1250), "1.3 s")
})

test("job status pills", () => {
  assert.deepEqual(jobStatus("RUNNING"), { label: "Running", tone: "blue" })
  assert.equal(jobStatus("COMPLETED").label, "Done")
})

test("ring segments follow the fixed order and never pass the total", () => {
  const counts = jobCounts({ valid: 5, bounce: 0, softBounce: 1, reject: 0, catchAll: 2, unknown: 2 })
  const segs = ringSegments(counts, 20)
  assert.deepEqual(segs.map((s) => s.category), ["VALID", "SOFT_BOUNCE", "CATCH_ALL", "UNKNOWN"])
  assert.equal(segs[0].start, 0)
  assert.equal(segs[1].start, 0.25)
  assert.equal(segs.reduce((a, s) => a + s.length, 0), 0.5)
  assert.deepEqual(ringSegments(counts, 0), [])
})

test("line count of a paste", () => {
  assert.equal(lineCount("a@x.com\n\n  \nb@x.com\r\nc@x.com\r"), 3)
  assert.equal(lineCount(""), 0)
})

test("server states", () => {
  assert.equal(serverState("WAITING")?.tone, "amber")
  assert.equal(serverState(undefined), null)
})
