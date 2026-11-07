import { serviceTone } from "@/lib/mta"

/** One MTA service with its systemd state (green only when active). */
export function ServicePill({ name, state }: { name: string; state: string }) {
  return <span className={`pill ${serviceTone(state)}`} title={`${name}: ${state}`}>{name}: {state}</span>
}
