import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { bytes, driveLinkProblem, isListFile, OffsetMismatch, sendFile, type UploadState, validatedCount } from "./lists.ts"

function fakeServer(size: number) {
  let received = 0
  const calls: number[] = []
  return {
    calls,
    get received() { return received },
    put: async (offset: number, chunk: Blob): Promise<UploadState> => {
      calls.push(offset)
      if (offset > received) throw new OffsetMismatch(received)
      received = Math.max(received, offset + chunk.size)
      return { publicId: "x", status: received === size ? "MAPPING" : "UPLOADING", received, size }
    },
  }
}

const noWait = async () => {}

describe("sendFile", () => {
  it("sends chunks in order and reports only what the server has", async () => {
    const file = new Blob([new Uint8Array(25)])
    const server = fakeServer(25)
    const seen: number[] = []
    const last = await sendFile({ file, from: 0, put: server.put, chunkSize: 10, onProgress: (s) => seen.push(s.received), wait: noWait })
    assert.deepEqual(server.calls, [0, 10, 20])
    assert.deepEqual(seen, [10, 20, 25])
    assert.equal(last?.status, "MAPPING")
  })

  it("goes on from where the server stands after a break", async () => {
    const file = new Blob([new Uint8Array(25)])
    const server = fakeServer(25)
    await server.put(0, file.slice(0, 10))
    await sendFile({ file, from: server.received, put: server.put, chunkSize: 10, onProgress: () => {}, wait: noWait })
    assert.deepEqual(server.calls, [0, 10, 20])
  })

  it("follows the server's position when a chunk starts in the wrong place", async () => {
    const file = new Blob([new Uint8Array(20)])
    const server = fakeServer(20)
    await sendFile({ file, from: 10, put: server.put, chunkSize: 10, onProgress: () => {}, wait: noWait })
    assert.deepEqual(server.calls, [10, 0, 10])
  })

  it("retries a failed chunk, but not a refusal", async () => {
    const file = new Blob([new Uint8Array(10)])
    const server = fakeServer(10)
    let fails = 2
    const flaky = async (o: number, c: Blob) => {
      if (fails-- > 0) throw new Error("network")
      return server.put(o, c)
    }
    const last = await sendFile({ file, from: 0, put: flaky, chunkSize: 10, onProgress: () => {}, wait: noWait })
    assert.equal(last?.received, 10)

    const refused = Object.assign(new Error("too big"), { status: 413 })
    let tries = 0
    await assert.rejects(sendFile({
      file, from: 0, chunkSize: 10, onProgress: () => {}, wait: noWait,
      put: async () => { tries++; throw refused },
    }))
    assert.equal(tries, 1)
  })
})

describe("list helpers", () => {
  it("formats sizes", () => {
    assert.equal(bytes(500), "500 B")
    assert.equal(bytes(2048), "2 KB")
    assert.equal(bytes(3.5 * 1024 * 1024), "3.5 MB")
    assert.equal(bytes(2 * 1024 ** 3), "2 GB")
    assert.equal(bytes(null), "—")
  })

  it("takes .txt and .csv files only", () => {
    assert.ok(isListFile("Leads.CSV"))
    assert.ok(isListFile("a.txt"))
    assert.ok(!isListFile("a.xlsx"))
    assert.ok(!isListFile("a.zip"))
  })

  it("checks Drive links lightly", () => {
    assert.equal(driveLinkProblem("https://drive.google.com/file/d/abc/view"), null)
    assert.equal(driveLinkProblem("https://docs.google.com/spreadsheets/d/abc/edit"), null)
    assert.match(driveLinkProblem("https://evil.example/file") ?? "", /Only Google Drive/)
    assert.match(driveLinkProblem("https://drive.google.com/drive/folders/abc") ?? "", /folder/)
    assert.match(driveLinkProblem("") ?? "", /Paste/)
  })

  it("adds up the latest results", () => {
    assert.equal(validatedCount({ VALID: 3, BOUNCE: 1 }), 4)
    assert.equal(validatedCount(undefined), 0)
  })
})
