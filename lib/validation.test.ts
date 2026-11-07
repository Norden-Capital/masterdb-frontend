import assert from "node:assert/strict"
import { test } from "node:test"

import { CATEGORIES, categoryMeta, duration, looksLikeEmail } from "./validation.ts"

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
