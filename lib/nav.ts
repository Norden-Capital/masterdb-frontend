/**
 * Sidebar menu logic, kept free of React so `npm test` can check it.
 * The entries themselves (labels, icons) live in components/md/app-frame.tsx.
 */

export type NavEntry =
  | { grp: string }
  | { spacer: true }
  | { key: string; label: string; href?: string; perm?: string; soon?: boolean }

/**
 * What the sidebar shows: entries whose permission the user lacks are dropped
 * (hidden, not greyed), and so is a group heading with nothing left under it.
 * Modules that are not built yet stay in the list; the frame greys them.
 */
export function visibleNav<T extends NavEntry>(nav: readonly T[], can: (permission: string) => boolean): T[] {
  const allowed = nav.filter((n) => !("key" in n) || !n.perm || can(n.perm))
  return allowed.filter((n, i) => !("grp" in n) || (i + 1 < allowed.length && "key" in allowed[i + 1]))
}

/** "/" only matches itself; any other link also matches the pages under it. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** The top bar title: the first prefix that matches the path. */
export function pageTitle(pathname: string, titles: readonly (readonly [string, string])[]): string {
  return titles.find(([p]) => isActive(p, pathname))?.[1] ?? ""
}
