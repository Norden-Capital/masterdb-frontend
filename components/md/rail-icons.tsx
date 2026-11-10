import { Category2, DocumentText, Driver, Global, Logout, People, Setting2, ShieldTick } from "iconsax-react"

/**
 * Icons of the left rail. Iconsax "Bulk" (two tones of the current colour,
 * as in the reference): grey, orange when active. Help is drawn here in the
 * same style. Sized by md.css.
 */
type P = React.SVGProps<SVGSVGElement>

const base = { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true } as const
const SOFT = 0.38
const bulk = (Icon: typeof Category2) => {
  function RailIcon(p: P) {
    return <Icon variant="Bulk" color="currentColor" aria-hidden="true" className={p.className} />
  }
  return RailIcon
}

export const DashboardIcon = bulk(Category2)
export const ListsIcon = bulk(DocumentText)
export const ValidationIcon = bulk(ShieldTick)
export const DnsIcon = bulk(Global)
export const ServersIcon = bulk(Driver)
export const UsersIcon = bulk(People)
export const SettingsIcon = bulk(Setting2)
export const LogoutIcon = bulk(Logout)

export function HelpIcon(p: P) {
  return (
    <svg {...base} {...p}>
      <circle opacity={SOFT} cx="12" cy="12" r="9.5" />
      <path d="M12 6.5c-2 0-3.6 1.3-3.8 3.1a1 1 0 0 0 2 .3c.1-.8.8-1.4 1.8-1.4s1.8.7 1.8 1.5c0 .7-.3 1-1.1 1.5-1 .6-1.7 1.3-1.7 2.6v.3a1 1 0 0 0 2 0v-.3c0-.5.2-.7.9-1.1 1-.6 1.9-1.4 1.9-3 0-2-1.7-3.5-3.8-3.5Z" />
      <circle cx="12" cy="17.2" r="1.2" />
    </svg>
  )
}
