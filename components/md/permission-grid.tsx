"use client"

import {
  Ban, Contact, DatabaseBackup, Filter, Globe, LayoutDashboard, Mails, ScrollText, Server, Settings, ShieldCheck, Users,
} from "lucide-react"
import { useEffect, useRef } from "react"

import type { Catalogue } from "@/lib/types"

const ICONS: Record<string, React.ComponentType> = {
  DASHBOARD: LayoutDashboard, CONTACTS: Contact, VALIDATION: ShieldCheck, SERVERS: Server, MTA: Mails, DNS: Globe, SEGMENTS: Filter, SUPPRESSION: Ban,
  USERS: Users, ACTIVITY_LOG: ScrollText, BACKUPS: DatabaseBackup, SETTINGS: Settings,
}

/** Every grantable MODULE:ACTION of the catalogue. */
export function allPermissions(catalogue: Catalogue): string[] {
  return catalogue.modules.flatMap((m) => m.actions.map((a) => `${m.key}:${a.key}`))
}

/** Any action on a module implies its VIEW (the backend saves it that way too). */
export function withView(perms: Set<string>): Set<string> {
  const out = new Set(perms)
  for (const p of perms) out.add(`${p.split(":")[0]}:VIEW`)
  return out
}

function Box(props: { checked: boolean; indeterminate?: boolean; disabled?: boolean; label: string; onChange: (v: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!props.indeterminate
  }, [props.indeterminate])
  return (
    <input ref={ref} type="checkbox" className="cb" checked={props.checked} disabled={props.disabled}
      aria-label={props.label} onChange={(e) => props.onChange(e.target.checked)} />
  )
}

/**
 * Modules × actions (mock 08/10). Column and row boxes switch a whole action or
 * module; rows that differ from `initial` are highlighted until saved. A box
 * whose permission the editor may not hand out (`grantable`) is disabled.
 */
export function PermissionGrid(props: {
  catalogue: Catalogue
  value: Set<string>
  initial?: Set<string>
  onChange: (next: Set<string>) => void
  disabled?: boolean
  grantable?: (permission: string) => boolean
}) {
  const { catalogue, value, initial, onChange, disabled } = props
  const can = (p: string) => !disabled && (props.grantable ? props.grantable(p) : true)
  const set = (perms: string[], on: boolean) => {
    const next = new Set(value)
    perms.filter(can).forEach((p) => (on ? next.add(p) : next.delete(p)))
    onChange(on ? withView(next) : next)
  }
  const toggle = (p: string, on: boolean) => {
    const next = new Set(value)
    if (on) next.add(p)
    else {
      next.delete(p)
      // Removing VIEW removes everything else on the module.
      if (p.endsWith(":VIEW")) [...next].filter((x) => x.startsWith(p.split(":")[0] + ":")).forEach((x) => next.delete(x))
    }
    onChange(on ? withView(next) : next)
  }

  return (
    <div className="tbl-scroll">
      <table className="perm">
        <thead>
          <tr>
            <th>Module</th>
            {catalogue.actions.map((a) => {
              const col = catalogue.modules.filter((m) => m.actions.some((x) => x.key === a.key)).map((m) => `${m.key}:${a.key}`)
              const n = col.filter((p) => value.has(p)).length
              return (
                <th key={a.key}>
                  <div className="colhead">
                    {a.label}
                    <Box checked={n === col.length && n > 0} indeterminate={n > 0 && n < col.length} disabled={disabled}
                      label={`Toggle ${a.label} for all modules`} onChange={(on) => set(col, on)} />
                  </div>
                </th>
              )
            })}
            <th><div className="colhead">All<span style={{ height: 16 }} /></div></th>
          </tr>
        </thead>
        <tbody>
          {catalogue.modules.map((m) => {
            const row = m.actions.map((a) => `${m.key}:${a.key}`)
            const n = row.filter((p) => value.has(p)).length
            const changed = initial && row.some((p) => value.has(p) !== initial.has(p))
            const Icon = ICONS[m.key] ?? Settings
            return (
              <tr key={m.key} className={changed ? "changed" : ""}>
                <td><span className="mod"><Icon />{m.label}</span></td>
                {catalogue.actions.map((a) => {
                  const p = `${m.key}:${a.key}`
                  if (!m.actions.some((x) => x.key === a.key)) {
                    return <td key={a.key} className="na" title="Not available for this module">—</td>
                  }
                  return (
                    <td key={a.key}>
                      <Box checked={value.has(p)} disabled={!can(p)} label={`${m.label}: ${a.label}`}
                        onChange={(on) => toggle(p, on)} />
                    </td>
                  )
                })}
                <td>
                  <Box checked={n === row.length} indeterminate={n > 0 && n < row.length} disabled={disabled}
                    label={`Toggle all for ${m.label}`} onChange={(on) => set(row, on)} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** "View, create, export" per module, or "No access" (mock 09 right column). */
export function PermissionSummary({ catalogue, perms }: { catalogue: Catalogue; perms: Set<string> }) {
  const rows = catalogue.modules.map((m) => {
    const acts = m.actions.filter((a) => perms.has(`${m.key}:${a.key}`)).map((a) => a.label.toLowerCase())
    return { label: m.label, text: acts.length ? acts.join(", ").replace(/^./, (c) => c.toUpperCase()) : "" }
  })
  const none = rows.filter((r) => !r.text).map((r) => r.label)
  return (
    <div className="permsum">
      {rows.filter((r) => r.text).map((r) => (
        <div key={r.label}><span>{r.label}</span><span>{r.text}</span></div>
      ))}
      {none.length > 0 && <div><span>{none.join(", ")}</span><span>No access</span></div>}
    </div>
  )
}
