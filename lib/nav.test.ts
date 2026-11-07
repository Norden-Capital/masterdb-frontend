import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isActive, type NavEntry, pageTitle, visibleNav } from "./nav.ts"

const NAV: NavEntry[] = [
  { grp: "Workspace" },
  { key: "dashboard", label: "Dashboard", href: "/" },
  { key: "contacts", label: "Contacts", perm: "CONTACTS:VIEW", soon: true },
  { grp: "Admin" },
  { key: "users", label: "Users", href: "/users", perm: "USERS:VIEW" },
  { key: "activity", label: "Activity", href: "/activity", perm: "ACTIVITY_LOG:VIEW" },
  { spacer: true },
  { key: "help", label: "Help", soon: true },
]

const keys = (list: NavEntry[]) => list.map((n) => ("key" in n ? n.key : "grp" in n ? `#${n.grp}` : "|"))

describe("visibleNav", () => {
  it("shows everything to someone who may do everything", () => {
    assert.deepEqual(keys(visibleNav(NAV, () => true)),
      ["#Workspace", "dashboard", "contacts", "#Admin", "users", "activity", "|", "help"])
  })

  it("hides items without the view permission, and an empty group heading with them", () => {
    assert.deepEqual(keys(visibleNav(NAV, () => false)), ["#Workspace", "dashboard", "|", "help"])
  })

  it("keeps a group heading while one item under it is allowed", () => {
    assert.deepEqual(keys(visibleNav(NAV, (p) => p === "ACTIVITY_LOG:VIEW")),
      ["#Workspace", "dashboard", "#Admin", "activity", "|", "help"])
  })

  it("drops a heading at the very end", () => {
    assert.deepEqual(keys(visibleNav([{ key: "a", label: "A" }, { grp: "Last" }], () => true)), ["a"])
  })
})

describe("isActive", () => {
  it("matches the dashboard only on /", () => {
    assert.equal(isActive("/", "/"), true)
    assert.equal(isActive("/", "/users"), false)
  })

  it("matches a module and its sub-pages but not a longer name", () => {
    assert.equal(isActive("/users", "/users"), true)
    assert.equal(isActive("/users", "/users/abc/permissions"), true)
    assert.equal(isActive("/users", "/users-archive"), false)
  })
})

describe("pageTitle", () => {
  const titles = [["/users", "Users"], ["/", "Dashboard"]] as const
  it("uses the first match", () => {
    assert.equal(pageTitle("/users/1", titles), "Users")
    assert.equal(pageTitle("/", titles), "Dashboard")
    assert.equal(pageTitle("/nowhere", titles), "")
  })
})
