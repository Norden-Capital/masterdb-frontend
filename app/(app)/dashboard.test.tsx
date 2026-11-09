import { render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SessionProvider } from "@/components/md/session"
import { Dashboard } from "./dashboard"

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }) }))

const SUMMARY = {
  generatedAt: "2026-11-07T22:00:03Z",
  users: { total: 5, active: 2, invited: 2, disabled: 1 },
  openSessions: 3,
  activity: { last24Hours: 1234, last7Days: 2000 },
}

function backend(permissions: string[]) {
  const calls: string[] = []
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    calls.push(url)
    if (url === "/api/v1/auth/me") {
      return new Response(JSON.stringify({ publicId: "u1", email: "a@example.test", fullName: "Ann Lee", isOwner: false,
        permissions }))
    }
    if (url === "/api/v1/dashboard/summary") return new Response(JSON.stringify(SUMMARY))
    return new Response("{}", { status: 404 })
  }))
  return calls
}

const value = (label: string) => within(screen.getByRole("group", { name: label })).getByText(/^[\d,—]+$/).textContent

describe("Dashboard", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("shows exactly the server's numbers", async () => {
    backend(["DASHBOARD:VIEW"])
    render(<SessionProvider><Dashboard /></SessionProvider>)
    expect(await screen.findByRole("group", { name: "Accounts" })).toBeTruthy()
    expect(value("Accounts")).toBe("5")
    expect(value("Active")).toBe("2")
    expect(value("Invited")).toBe("2")
    expect(value("Disabled")).toBe("1")
    expect(value("Signed in now")).toBe("3")
    expect(value("Last 24 hours")).toBe("1,234")
    expect(value("Last 7 days")).toBe("2,000")
  })

  it("shows no tiles for modules that don't exist yet", async () => {
    backend(["DASHBOARD:VIEW"])
    render(<SessionProvider><Dashboard /></SessionProvider>)
    await screen.findByRole("group", { name: "Accounts" })
    expect(screen.queryByText(/coming soon/i)).toBeNull()
  })

  it("without the permission: a welcome card and no call for numbers", async () => {
    const calls = backend(["USERS:VIEW"])
    render(<SessionProvider><Dashboard /></SessionProvider>)
    expect(await screen.findByText("Welcome, Ann")).toBeTruthy()
    expect(calls).not.toContain("/api/v1/dashboard/summary")
    expect(screen.queryByRole("group", { name: "Accounts" })).toBeNull()
  })
})
