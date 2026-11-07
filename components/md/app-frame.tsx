"use client"

import {
  Ban, ChevronDown, CircleHelp, Contact, DatabaseBackup, Filter, LayoutDashboard, LockKeyhole, LogOut,
  PanelLeftClose, PanelLeftOpen, ScrollText, Server, Settings, ShieldCheck, UserRound, Users,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { useSession } from "@/components/md/session"
import { useTheme } from "@/components/md/theme"
import { initials } from "@/lib/format"

type NavItem =
  | { grp: string }
  | { spacer: true }
  | { key: string; label: string; icon: React.ComponentType; href?: string; perm?: string; soon?: boolean }

/**
 * The menu (mock app.js NAV). Items the user may not open are hidden; modules
 * that are not built yet are shown greyed as "coming soon", never as fake pages.
 */
const NAV: NavItem[] = [
  { grp: "Workspace" },
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { key: "contacts", label: "Contacts & lists", icon: Contact, perm: "CONTACTS:VIEW", soon: true },
  { key: "validation", label: "Validation", icon: ShieldCheck, perm: "VALIDATION:VIEW", soon: true },
  { key: "servers", label: "Validation servers", icon: Server, perm: "VALIDATION_SERVERS:VIEW", soon: true },
  { key: "segments", label: "Segments & exports", icon: Filter, perm: "SEGMENTS:VIEW", soon: true },
  { key: "suppression", label: "Suppression", icon: Ban, perm: "SUPPRESSION:VIEW", soon: true },
  { grp: "Admin" },
  { key: "users", label: "Users & permissions", icon: Users, href: "/users", perm: "USERS:VIEW" },
  { key: "activity", label: "Activity log", icon: ScrollText, href: "/activity", perm: "ACTIVITY_LOG:VIEW" },
  { key: "backups", label: "Backups", icon: DatabaseBackup, perm: "BACKUPS:VIEW", soon: true },
  { spacer: true },
  { key: "help", label: "Help", icon: CircleHelp, soon: true },
  { key: "settings", label: "Settings", icon: Settings, perm: "SETTINGS:VIEW", soon: true },
]

const TITLES: [string, string][] = [
  ["/users", "Users & permissions"],
  ["/activity", "Activity log"],
  ["/account", "My account"],
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

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem("mdb-collapsed", next ? "1" : "0")
    } catch {
      // not remembered
    }
  }

  const title = TITLES.find(([p]) => (p === "/" ? pathname === "/" : pathname.startsWith(p)))?.[1] ?? ""
  // Hide a group heading when nothing under it is visible.
  const visible = NAV.filter((n) => !("key" in n) || !n.perm || can(n.perm))
  const items = visible.filter((n, i) => !("grp" in n) || (visible[i + 1] && "key" in visible[i + 1]))

  return (
    <div className={`app ${collapsed ? "collapsed" : ""}`}>
      <header className="topbar">
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
      <nav className="sidebar" aria-label="Main">
        {items.map((n, i) => {
          if ("spacer" in n) return <div className="spacer" key={`s${i}`} />
          if ("grp" in n) return <div className="grp" key={n.grp}>{n.grp}</div>
          const Icon = n.icon
          if (n.soon || !n.href) {
            return (
              <span className="nav-item soon" key={n.key} title={`${n.label}: coming soon`} aria-disabled="true">
                <Icon /><span>{n.label}</span>
              </span>
            )
          }
          const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)
          return (
            <Link className={`nav-item ${active ? "active" : ""}`} href={n.href} key={n.key} title={n.label}
              aria-current={active ? "page" : undefined}>
              <Icon /><span>{n.label}</span>
            </Link>
          )
        })}
        <button className="nav-item" onClick={toggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{ border: 0, background: "transparent", font: "inherit", cursor: "pointer" }}>
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}<span>Collapse</span>
        </button>
      </nav>
      <main className="main">{children}</main>
    </div>
  )
}
