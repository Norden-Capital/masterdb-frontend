"use client"

import { Ellipsis, LogOut, UserRound } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import {
  DashboardIcon, DnsIcon, HelpIcon, ListsIcon, LogoutIcon, ServersIcon, SettingsIcon, UsersIcon, ValidationIcon,
} from "@/components/md/rail-icons"
import { useSession } from "@/components/md/session"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { initials } from "@/lib/format"
import { activeTab, moduleFor, moduleHref, type NavModule, visibleModules, visibleTabs } from "@/lib/nav"

type Module = NavModule & { icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }

/**
 * The menu: modules in the icon rail, each module's pages as tabs under the
 * top bar. Pages the user may not open are hidden (the API checks again).
 * "Add …" pages are reached from the button on the module's list page.
 */
const MODULES: Module[] = [
  { key: "dashboard", label: "Dashboard", icon: DashboardIcon, tabs: [{ label: "Dashboard", href: "/" }] },
  { key: "lists", label: "Lists", icon: ListsIcon,
    tabs: [{ label: "Lists", href: "/lists/emails", perm: "LISTS:VIEW" }],
    extra: [{ label: "Add list", href: "/lists/add", perm: "LISTS:CREATE" }] },
  { key: "validation", label: "Validation", icon: ValidationIcon, tabs: [
    { label: "Check one email", href: "/validation/check", perm: "VALIDATION:VIEW" },
    { label: "Bulk validation", href: "/validation/bulk", perm: "VALIDATION:VIEW" },
    { label: "Results", href: "/validation/results", perm: "VALIDATION:VIEW" },
    { label: "List status", href: "/validation/status", perm: "VALIDATION:VIEW" },
  ] },
  { key: "dns", label: "DNS", icon: DnsIcon,
    tabs: [{ label: "Domains", href: "/dns/domains", perm: "DNS:VIEW" }, { label: "Namecheap account", href: "/dns/namecheap", perm: "DNS:VIEW" }],
    extra: [{ label: "Add domain", href: "/dns/add-domain", perm: "DNS:CREATE" }] },
  { key: "servers", label: "Servers", icon: ServersIcon,
    tabs: [
      { label: "Servers", href: "/servers/list", perm: "SERVERS:VIEW" },
      { label: "MTA list", href: "/mta/list", perm: "MTA:VIEW" },
      { label: "MTA manager", href: "/mta/manager", perm: "MTA:VIEW" },
    ],
    extra: [{ label: "Add VPS server", href: "/servers/add", perm: "SERVERS:CREATE" }, { label: "Install MTA", href: "/mta/install", perm: "MTA:CREATE" }] },
  { key: "users", label: "Users", icon: UsersIcon,
    tabs: [{ label: "Users & permissions", href: "/users", perm: "USERS:VIEW" }, { label: "Activity log", href: "/activity", perm: "ACTIVITY_LOG:VIEW" }] },
  { key: "account", label: "My account", icon: UserRound, hidden: true, tabs: [{ label: "My account", href: "/account" }] },
  { key: "dev", label: "Components", icon: DashboardIcon, hidden: true, tabs: [{ label: "Components", href: "/dev/components" }] },
]

/** Phone bottom bar: these four, then "More" for the rest. */
const BOTTOM = ["dashboard", "lists", "validation", "servers"]

export function AppFrame({ children }: { children: React.ReactNode }) {
  const { me, can, logout } = useSession()
  const pathname = usePathname()
  const [more, setMore] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!more) return
    const close = (e: MouseEvent) => { if (!moreRef.current?.contains(e.target as Node)) setMore(false) }
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMore(false)
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", esc)
    }
  }, [more])

  const modules = visibleModules(MODULES, can)
  const current = moduleFor(MODULES, pathname)
  const tabs = current ? visibleTabs(current, can) : []
  const tab = current ? activeTab(current, pathname) : undefined
  const bottom = BOTTOM.map((k) => modules.find((m) => m.key === k)).filter((m): m is Module => !!m)
  const rest = modules.filter((m) => !BOTTOM.includes(m.key))

  return (
    <div className="app collapsed">
      <header className="topbar">
        <Link className="logo" href="/"><span className="logo-mark">M</span>MasterDB</Link>
        <span className="tb-div" />
        <span className="tb-title">{current?.label ?? ""}</span>
        <span className="tb-spacer" />
        <Link className="tb-user" href="/account" title="My account">
          <span className="avatar">{initials(me.fullName)}</span>
          <div><b>{me.fullName}</b><span>{me.isOwner ? "Owner" : "Custom permissions"}</span></div>
        </Link>
      </header>

      <TooltipProvider delay={150}>
      <nav className="sidebar" aria-label="Main">
        {modules.map((m) => {
          const Icon = m.icon
          const href = moduleHref(m, can) ?? "/"
          const active = current?.key === m.key
          return (
            <RailTip key={m.key} label={m.label}>
              <Link className={`nav-item ${active ? "active" : ""}`} href={href} aria-label={m.label}
                aria-current={active ? "page" : undefined}>
                <Icon /><span>{m.label}</span>
              </Link>
            </RailTip>
          )
        })}
        <span className="spacer" />
        {/* What Help does is still to be decided by the owner; it does nothing yet. */}
        <RailTip label="Help"><button type="button" className="nav-item" aria-label="Help"><HelpIcon /><span>Help</span></button></RailTip>
        <RailTip label="Settings">
          <Link className={`nav-item ${current?.key === "account" ? "active" : ""}`} href="/account" aria-label="Settings">
            <SettingsIcon /><span>Settings</span>
          </Link>
        </RailTip>
        <RailTip label="Log out">
          <button type="button" className="nav-item nav-logout" aria-label="Log out" aria-haspopup="dialog"
            onClick={() => setConfirmLogout(true)}>
            <LogoutIcon /><span>Log out</span>
          </button>
        </RailTip>
      </nav>
      </TooltipProvider>

      <main className="main">
        {tabs.length > 1 && (
          <nav className="subtabs" aria-label={`${current?.label} pages`}>
            {tabs.map((t) => (
              <Link key={t.href} href={t.href} className={tab?.href === t.href ? "active" : ""} aria-current={tab?.href === t.href ? "page" : undefined}>
                {t.label}
              </Link>
            ))}
          </nav>
        )}
        {children}
      </main>

      <nav className="bottombar" aria-label="Main">
        {bottom.map((m) => {
          const Icon = m.icon
          return (
            <Link key={m.key} href={moduleHref(m, can) ?? "/"} className={current?.key === m.key ? "on" : ""}
              aria-current={current?.key === m.key ? "page" : undefined}>
              <Icon />{m.label}
            </Link>
          )
        })}
        <div ref={moreRef} style={{ display: "contents" }}>
          <button className={current && !BOTTOM.includes(current.key) ? "on" : ""} aria-haspopup="menu" aria-expanded={more}
            onClick={() => setMore(!more)}>
            <Ellipsis />More
          </button>
          {more && (
            <div className="more-sheet" role="menu">
              {rest.map((m) => {
                const Icon = m.icon
                return <Link key={m.key} role="menuitem" href={moduleHref(m, can) ?? "/"} onClick={() => setMore(false)}><Icon />{m.label}</Link>
              })}
              <hr />
              <Link role="menuitem" href="/account" onClick={() => setMore(false)}><UserRound />My account</Link>
              <button role="menuitem" className="more-logout" onClick={() => { setMore(false); setConfirmLogout(true) }}>
                <LogOut />Log out
              </button>
            </div>
          )}
        </div>
      </nav>

      <AlertDialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out of MasterDB?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll need your password and a two-factor code to log in again. Running jobs keep going.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => { setConfirmLogout(false); logout() }}>
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** shadcn tooltip to the right of a rail icon. */
function RailTip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right" sideOffset={10}>{label}</TooltipContent>
    </Tooltip>
  )
}
