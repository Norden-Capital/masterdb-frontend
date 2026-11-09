import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { activeTab, isActive, moduleFor, moduleHref, type NavModule, visibleModules, visibleTabs } from "./nav.ts"

const MODULES: NavModule[] = [
  { key: "dashboard", label: "Dashboard", tabs: [{ label: "Dashboard", href: "/" }] },
  { key: "dns", label: "DNS", tabs: [{ label: "Domains", href: "/dns/domains", perm: "DNS:VIEW" }],
    extra: [{ label: "Add domain", href: "/dns/add-domain", perm: "DNS:CREATE" }] },
  { key: "servers", label: "Servers",
    tabs: [{ label: "Servers", href: "/servers/list", perm: "SERVERS:VIEW" }, { label: "MTA list", href: "/mta/list", perm: "MTA:VIEW" }] },
  { key: "users", label: "Users",
    tabs: [{ label: "Users", href: "/users", perm: "USERS:VIEW" }, { label: "Activity log", href: "/activity", perm: "ACTIVITY_LOG:VIEW" }] },
  { key: "account", label: "My account", hidden: true, tabs: [{ label: "My account", href: "/account" }] },
]

const keys = (list: NavModule[]) => list.map((m) => m.key)

describe("visibleModules", () => {
  it("shows every module to someone who may do everything, but never a hidden one", () => {
    assert.deepEqual(keys(visibleModules(MODULES, () => true)), ["dashboard", "dns", "servers", "users"])
  })

  it("hides a module when no page of it is allowed", () => {
    assert.deepEqual(keys(visibleModules(MODULES, () => false)), ["dashboard"])
  })

  it("keeps a module when only one of its tabs is allowed", () => {
    assert.deepEqual(keys(visibleModules(MODULES, (p) => p === "ACTIVITY_LOG:VIEW")), ["dashboard", "users"])
  })

  it("keeps a module when only its add page is allowed", () => {
    assert.deepEqual(keys(visibleModules(MODULES, (p) => p === "DNS:CREATE")), ["dashboard", "dns"])
  })
})

describe("moduleHref and visibleTabs", () => {
  it("goes to the first allowed tab", () => {
    assert.equal(moduleHref(MODULES[3], (p) => p === "ACTIVITY_LOG:VIEW"), "/activity")
    assert.deepEqual(visibleTabs(MODULES[3], (p) => p === "ACTIVITY_LOG:VIEW").map((t) => t.href), ["/activity"])
  })

  it("falls back to an allowed extra page, else null", () => {
    assert.equal(moduleHref(MODULES[1], (p) => p === "DNS:CREATE"), "/dns/add-domain")
    assert.equal(moduleHref(MODULES[1], () => false), null)
  })
})

describe("moduleFor and activeTab", () => {
  it("finds the module of a tab, a detail page and an extra page", () => {
    assert.equal(moduleFor(MODULES, "/mta/list")?.key, "servers")
    assert.equal(moduleFor(MODULES, "/users/abc/permissions")?.key, "users")
    assert.equal(moduleFor(MODULES, "/dns/add-domain")?.key, "dns")
    assert.equal(moduleFor(MODULES, "/")?.key, "dashboard")
    assert.equal(moduleFor(MODULES, "/nowhere"), undefined)
  })

  it("marks the tab of a detail page, and none for an extra page", () => {
    assert.equal(activeTab(MODULES[3], "/users/abc")?.href, "/users")
    assert.equal(activeTab(MODULES[1], "/dns/add-domain"), undefined)
  })
})

describe("isActive", () => {
  it("matches the dashboard only on /", () => {
    assert.equal(isActive("/", "/"), true)
    assert.equal(isActive("/", "/users"), false)
  })

  it("matches a page and its sub-pages but not a longer name", () => {
    assert.equal(isActive("/users", "/users"), true)
    assert.equal(isActive("/users", "/users/abc/permissions"), true)
    assert.equal(isActive("/users", "/users-archive"), false)
  })
})
