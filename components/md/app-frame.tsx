"use client"

import {
  Ban, ChevronDown, CircleHelp, Contact, DatabaseBackup, Filter, Globe, KeyRound, LayoutDashboard, List, LockKeyhole,
  LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, ScrollText, Server, Settings, ShieldCheck, UserRound, Users, X,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { useSession } from "@/components/md/session"
import { useTheme } from "@/components/md/theme"
import { initials } from "@/lib/format"
import { isActive, type NavEntry, pageTitle, visibleNav } from "@/lib/nav"

type NavItem = Exclude<NavEntry, { key: string }> | (Extract<NavEntry, { key: string }> & { icon: React.ComponentType })

/**
 * The menu (mock app.js NAV). Items the user may not open are hidden; modules
 * that are not built yet are shown greyed as "coming soon", never as fake pages.
 * Lists have no permission of their own: they belong to Contacts (CONTACTS:VIEW).
 */
const NAV: NavItem[] = [
  { grp: "Workspace" },
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/", perm: "DASHBOARD:VIEW" },
  { key: "contacts", label: "Contacts", icon: Contact, perm: "CONTACTS:VIEW", soon: true },
  { key: "lists", label: "Lists", icon: List, perm: "CONTACTS:VIEW", soon: true },
  { key: "validation", label: "Validation", icon: ShieldCheck, perm: "VALIDATION:VIEW", soon: true },
  { key: "servers", label: "Validation servers", icon: Server, perm: "VALIDATION_SERVERS:VIEW", soon: true },
  { key: "segments", label: "Segments & exports", icon: Filter, perm: "SEGMENTS:VIEW", soon: true },
  { key: "suppression", label: "Suppression", icon: Ban, perm: "SUPPRESSION:VIEW", soon: true },
  { grp: "DNS management" },
  { key: "namecheap", label: "Namecheap account", icon: KeyRound, href: "/dns/namecheap", perm: "DNS:VIEW" },
  { key: "add-domain", label: "Add domain", icon: Plus, perm: "DNS:CREATE", soon: true },
  { key: "domains", label: "Domain list", icon: Globe, perm: "DNS:VIEW", soon: true },
  { grp: "Admin" },
  { key: "users", label: "Users & permissions", icon: Users, href: "/users", perm: "USERS:VIEW" },
  { key: "activity", label: "Activity log", icon: ScrollText, href: "/activity", perm: "ACTIVITY_LOG:VIEW" },
  { key: "backups", label: "Backups", icon: DatabaseBackup, perm: "BACKUPS:VIEW", soon: true },
  { spacer: true },
  { key: "help", label: "Help", icon: CircleHelp, soon: true },
  { key: "settings", label: "Settings", icon: Settings, perm: "SETTINGS:VIEW", soon: true },
]

const TITLES: (readonly [string, string])[] = [
  ["/dns/namecheap", "Namecheap account"],
  ["/users", "Users & permissions"],
  ["/activity", "Activity log"],
  ["/account", "My account"],
  ["/dev/components", "Components"],
  ["/", "Dashboard"],
]

export function AppFrame({ children }: { children: React.ReactNode }) {
  const { me, can, logout } = useSession()
  const pathname = usePathname()
  // Rendered only after /me loaded in the browser, so storage can be read here.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("mdb-collapsed") === "1"
    } catch {
      return false
    }
  })
  const [menuOpen, setMenuOpen] = useState(false)
  // Phone width: the sidebar is a drawer over the page, closed by default.
  const [drawer, setDrawer] = useState(false)
  const [theme, setTheme] = useTheme()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false)
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", esc)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!drawer) return
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false)
    // Back to a wider window: the drawer has no meaning there.
    const mq = matchMedia("(min-width: 601px)")
    const wide = () => mq.matches && setDrawer(false)
    document.addEventListener("keydown", esc)
    mq.addEventListener("change", wide)
    return () => {
      document.removeEventListener("keydown", esc)
      mq.removeEventListener("change", wide)
    }
  }, [drawer])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem("mdb-collapsed", next ? "1" : "0")
    } catch {
      // not remembered
    }
  }

  const title = pageTitle(pathname, TITLES)
  const items = visibleNav(NAV, can)
  const closeDrawer = () => setDrawer(false)

  return (
    <div className={`app ${collapsed ? "collapsed" : ""} ${drawer ? "drawer-open" : ""}`}>
      <header className="topbar">
        <button className="tb-icon tb-menu" aria-label={drawer ? "Close menu" : "Open menu"} aria-expanded={drawer}
          aria-controls="md-sidebar" onClick={() => setDrawer(!drawer)}>
          {drawer ? <X /> : <Menu />}
        </button>
        <Link className="logo" href="/"><span className="logo-mark">M</span>MasterDB</Link>
        <span className="tb-div" />
        <span className="tb-title">{title}</span>
        <span style={{ marginLeft: "auto" }} />
        <div ref={menuRef} style={{ position: "relative" }}>
          <button className="tb-user" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            <span className="avatar">{initials(me.fullName)}</span>
            <div><b>{me.fullName}</b><span>{me.isOwner ? "Owner" : "Custom permissions"}</span></div>
            <ChevronDown style={{ color: "var(--topbar-muted)" }} />
          </button>
          {menuOpen && (
            <div className="menu user-menu" role="menu" style={{ right: 0, top: 52 }}>
              <div className="head">
                <b style={{ display: "block" }}>{me.fullName}</b>
                <span className="muted small">{me.email}</span>
              </div>
              <Link href="/account" role="menuitem" onClick={() => setMenuOpen(false)}><UserRound />My profile</Link>
              <Link href="/account/security" role="menuitem" onClick={() => setMenuOpen(false)}><LockKeyhole />Security</Link>
              <hr />
              <div className="muted small" style={{ padding: "2px 10px" }}>Theme</div>
              <div className="theme-row">
                {(["light", "dark", "system"] as const).map((t) => (
                  <button key={t} className={theme === t ? "on" : ""} onClick={() => setTheme(t)} aria-pressed={theme === t}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <hr />
              <button className="danger" role="menuitem" onClick={logout}><LogOut />Log out</button>
            </div>
          )}
        </div>
      </header>
      {drawer && <div className="drawer-backdrop" onClick={closeDrawer} aria-hidden="true" />}
      <nav className="sidebar" id="md-sidebar" aria-label="Main">
        {items.map((n, i) => {
          if ("spacer" in n) return <div className="spacer" key={`s${i}`} />
          if ("grp" in n) return <div className="grp" key={n.grp}>{n.grp}</div>
          const Icon = n.icon
          if (n.soon || !n.href) {
            return (
              <span className="nav-item soon" key={n.key} title={`${n.label}: coming soon`} aria-disabled="true">
                <Icon /><span>{n.label}</span><span className="soon-tag">Soon</span>
              </span>
            )
          }
          const active = isActive(n.href, pathname)
          return (
            <Link className={`nav-item ${active ? "active" : ""}`} href={n.href} key={n.key} title={n.label}
              aria-current={active ? "page" : undefined} onClick={closeDrawer}>
              <Icon /><span>{n.label}</span>
            </Link>
          )
        })}
        <button className="nav-item nav-collapse" onClick={toggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{ border: 0, background: "transparent", font: "inherit", cursor: "pointer" }}>
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}<span>Collapse</span>
        </button>
      </nav>
      <main className="main">{children}</main>
    </div>
  )
}
