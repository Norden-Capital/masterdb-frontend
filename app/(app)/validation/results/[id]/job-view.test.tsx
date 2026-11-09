import { render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SessionProvider } from "@/components/md/session"
import { JobView } from "./job-view"

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "j1" }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}))

function job(over: object) {
  return {
    publicId: "j1", name: "March leads", source: "PASTE", status: "RUNNING", total: 20, pending: 10, checked: 10,
    valid: 5, bounce: 2, softBounce: 0, reject: 1, catchAll: 1, unknown: 1, duplicates: 3, invalid: 2, retries: 0,
    servers: [{ publicId: "s1", name: "probe1", ip: "203.0.113.5", checked: 10, state: "WAITING",
      message: "Paused for Gmail / Google Workspace after a \"slow down\" answer; nothing else to check." }],
    perMinute: 12, startedBy: "owner@example.com", createdAt: "2026-11-07T09:00:00Z", startedAt: "2026-11-07T09:00:00Z", ...over,
  }
}

function backend(permissions: string[], jobBody: object) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/v1/auth/me") {
      return new Response(JSON.stringify({ publicId: "u1", email: "a@example.test", fullName: "Ann Lee", isOwner: false, permissions }))
    }
    if (url === "/api/v1/validation/jobs/j1") return new Response(JSON.stringify(jobBody))
    if (url.startsWith("/api/v1/validation/jobs/j1/emails")) {
      return new Response(JSON.stringify({ items: [{ email: "b@example.com", category: "BOUNCE", reason: "The mailbox doesn't exist.",
        serverName: "probe1", checkedAt: "2026-11-07T09:01:00Z", jobName: "March leads", jobId: "j1" }], page: 0, size: 25, totalItems: 1, totalPages: 1 }))
    }
    return new Response("{}", { status: 404 })
  }))
}

const value = (label: string) => within(screen.getByRole("group", { name: label })).getByText(/^[\d,—]+$/).textContent

describe("JobView", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("shows the server's numbers, what each server does, and only the actions that fit", async () => {
    backend(["VALIDATION:VIEW", "VALIDATION:RUN", "VALIDATION:EXPORT"], job({}))
    render(<SessionProvider><JobView /></SessionProvider>)
    expect(await screen.findByRole("heading", { name: "March leads" })).toBeTruthy()
    expect(screen.getByRole("progressbar", { name: "Addresses checked" }).getAttribute("aria-valuetext")).toBe("10 of 20 checked (50%)")
    expect(value("To check")).toBe("10")
    expect(value("Duplicates dropped")).toBe("3")
    expect(screen.getByText("Waiting")).toBeTruthy()
    expect(screen.getByText(/Paused for Gmail/)).toBeTruthy()
    expect(screen.getByRole("button", { name: /Stop/ })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Retry unknown/ })).toBeNull()
    expect(screen.queryByRole("button", { name: "Delete job" })).toBeNull()
    expect(screen.getByRole("link", { name: "Valid (5)" }).getAttribute("href")).toBe("/api/v1/validation/jobs/j1/export?category=VALID")
    expect((screen.getByRole("button", { name: "Soft bounce (0)" }) as HTMLButtonElement).disabled).toBe(true)
    expect(await screen.findByText("b@example.com")).toBeTruthy()
  })

  it("a finished job offers retry unknown and delete, and no stop", async () => {
    backend(["VALIDATION:VIEW", "VALIDATION:RUN", "VALIDATION:DELETE"], job({ status: "COMPLETED", pending: 0, checked: 20, valid: 15, servers: [] }))
    render(<SessionProvider><JobView /></SessionProvider>)
    expect(await screen.findByRole("button", { name: "Retry unknown (1)" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Delete job" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /^Stop/ })).toBeNull()
    expect(screen.getByText("Done")).toBeTruthy()
    expect(screen.queryByText("Exports")).toBeNull()
  })
  it("a job on a list links to it, offers CSVs with the list's columns, and can't be stopped while preparing", async () => {
    backend(["VALIDATION:VIEW", "VALIDATION:RUN", "VALIDATION:EXPORT"], job({ source: "LIST", status: "PREPARING",
      message: "Copying the list's addresses: 50,000 of 120,000.", list: { publicId: "l1", name: "Leads", part: 2 } }))
    render(<SessionProvider><JobView /></SessionProvider>)
    expect(await screen.findByText("Preparing", { selector: ".pill" })).toBeTruthy()
    expect(screen.getByText(/50,000 of 120,000/)).toBeTruthy()
    expect(screen.getByRole("link", { name: "Leads · part 2" }).getAttribute("href")).toBe("/lists/emails/l1")
    expect(screen.queryByRole("button", { name: /Stop/ })).toBeNull()
    expect(screen.getByRole("link", { name: "Bounce" }).getAttribute("href")).toBe("/api/v1/validation/jobs/j1/export?category=BOUNCE&format=csv")
  })
})
