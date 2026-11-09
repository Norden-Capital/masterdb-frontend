/**
 * Menu logic, kept free of React so `npm test` can check it. The sidebar
 * shows modules only (icon rail); a module's pages are the tabs under the top
 * bar. "Add …" pages are not tabs: they open from the button on the module's
 * list page, so they are `extra` pages that still belong to the module.
 * The entries themselves (labels, icons) live in components/md/app-frame.tsx.
 */

export type NavPage = { label: string; href: string; perm?: string }

export type NavModule = {
  key: string
  label: string
  /** Pages shown as tabs, in order. */
  tabs: NavPage[]
  /** Pages of the module that are not tabs (add / install pages). */
  extra?: NavPage[]
  /** Not in the sidebar (e.g. My account), but still gives the top bar its title. */
  hidden?: boolean
}

type Can = (permission: string) => boolean

const allowed = (p: NavPage, can: Can) => !p.perm || can(p.perm)

/** "/" only matches itself; any other link also matches the pages under it. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** The tabs this user may open. */
export function visibleTabs(m: NavModule, can: Can): NavPage[] {
  return m.tabs.filter((p) => allowed(p, can))
}

/** Where the module's sidebar icon goes: its first allowed tab, else its first allowed extra page; null = no access. */
export function moduleHref(m: NavModule, can: Can): string | null {
  return visibleTabs(m, can)[0]?.href ?? (m.extra ?? []).find((p) => allowed(p, can))?.href ?? null
}

/** Sidebar items: modules the user can open at least one page of; hidden ones are left out. */
export function visibleModules<T extends NavModule>(modules: readonly T[], can: Can): T[] {
  return modules.filter((m) => !m.hidden && moduleHref(m, can) !== null)
}

/** The module a path belongs to: the longest matching page, so /mta/list is Servers and / only the dashboard. */
export function moduleFor<T extends NavModule>(modules: readonly T[], pathname: string): T | undefined {
  let best: { m: T; len: number } | undefined
  for (const m of modules) {
    for (const p of [...m.tabs, ...(m.extra ?? [])]) {
      if (isActive(p.href, pathname) && (!best || p.href.length > best.len)) best = { m, len: p.href.length }
    }
  }
  return best?.m
}

/** The active tab: the longest tab href that matches (a detail page keeps its list's tab). */
export function activeTab(m: NavModule, pathname: string): NavPage | undefined {
  return m.tabs.filter((p) => isActive(p.href, pathname)).sort((a, b) => b.href.length - a.href.length)[0]
}
