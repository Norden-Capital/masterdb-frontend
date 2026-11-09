"use client"

import { Gauge, Pencil } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { ModalForm } from "@/components/md/dialogs"
import { useSession } from "@/components/md/session"
import { ErrorState } from "@/components/md/states"
import { useToast } from "@/components/md/toast"
import { api } from "@/lib/api"
import { when } from "@/lib/format"
import type { PacingProvider, PacingView } from "@/lib/types"

/** Seconds with at most one decimal ("5 s", "1.7 s"). */
function seconds(ms: number): string {
  return `${Math.round(ms / 100) / 10} s`
}

function minutes(s: number): string {
  return s % 60 === 0 ? `${s / 60} min` : `${s} s`
}

/**
 * Pacing per email provider (saved in the database), and every pause running
 * now. Editing needs the Settings edit permission.
 */
export function PacingCard() {
  const { can } = useSession()
  const toast = useToast()
  const [view, setView] = useState<PacingView | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [editing, setEditing] = useState<PacingProvider | null>(null)
  const [form, setForm] = useState({ gap: "", global: "", rate: "", block: "", max: "" })

  const load = useCallback(() => {
    api<PacingView>("/api/v1/validation/pacing").then((v) => { setError(null); setView(v) }, setError)
  }, [])
  useEffect(() => { load() }, [load])

  function edit(p: PacingProvider) {
    setForm({ gap: String(p.gapMs / 1000), global: String(p.globalGapMs / 1000), rate: String(p.rateCooldownS / 60),
      block: String(p.blockCooldownS / 60), max: String(p.maxCooldownS / 60) })
    setEditing(p)
  }

  async function save() {
    if (!editing) return
    const n = (v: string) => Number(v.replace(",", "."))
    await api(`/api/v1/validation/pacing/${editing.key}`, {
      method: "PUT",
      body: {
        gapMs: Math.round(n(form.gap) * 1000), globalGapMs: Math.round(n(form.global) * 1000),
        rateCooldownS: Math.round(n(form.rate) * 60), blockCooldownS: Math.round(n(form.block) * 60), maxCooldownS: Math.round(n(form.max) * 60),
      },
    })
    toast(`Pacing of ${editing.label} saved`)
    load()
  }

  const valid = Object.values(form).every((v) => v.trim() !== "" && Number.isFinite(Number(v.replace(",", "."))) && Number(v.replace(",", ".")) >= 0)

  return (
    <div className="card">
      <div className="card-head"><Gauge size={18} /><h2>Pacing per email provider</h2>
        <span className="right small muted">Slows checks down so providers don&apos;t block the servers</span></div>
      {error ? <ErrorState title="Couldn't load the pacing" error={error} onRetry={load} style={{ margin: 16 }} /> : null}
      {view && (
        <>
          <div className="tbl-scroll">
            <table className="t" aria-label="Pacing per provider">
              <thead><tr><th>Provider</th><th>Wait per server</th><th>Wait, all servers</th><th>Pause after “slow down”</th><th>Pause after “blocked”</th><th /></tr></thead>
              <tbody>
                {view.providers.map((p) => (
                  <tr key={p.key}>
                    <td><b>{p.label}</b></td>
                    <td className="num">{seconds(p.gapMs)}</td>
                    <td className="num">{seconds(p.globalGapMs)}</td>
                    <td className="num">{minutes(p.rateCooldownS)}<div className="small muted">doubles, up to {minutes(p.maxCooldownS)}</div></td>
                    <td className="num">{minutes(p.blockCooldownS)}</td>
                    <td>{can("SETTINGS:EDIT") && <button className="btn" onClick={() => edit(p)} aria-label={`Edit ${p.label}`}><Pencil /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-pad">
            {view.paused.length === 0
              ? <p className="small muted" style={{ margin: 0 }}>No provider is paused right now.</p>
              : (
                <>
                  <p className="small" style={{ margin: "0 0 8px", fontWeight: 600 }}>Paused right now</p>
                  <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                    {view.paused.map((p) => (
                      <li key={`${p.serverName}-${p.provider}`}><b>{p.label}</b> on {p.serverName} until {when(p.until)}
                        {p.reason && <span className="muted mono"> · {p.reason}</span>}</li>
                    ))}
                  </ul>
                </>
              )}
          </div>
        </>
      )}
      <ModalForm open={!!editing} onClose={() => setEditing(null)} onSubmit={save} title={`Pacing of ${editing?.label ?? ""}`}
        text="Used from the next check on. Shorter waits finish faster but risk blocks." submitLabel="Save" canSubmit={valid} icon={<Gauge />}>
        <div className="grid-2" style={{ gap: 12 }}>
          {([["gap", "Wait per server (seconds)"], ["global", "Wait, all servers (seconds)"], ["rate", "Pause after “slow down” (minutes)"],
            ["block", "Pause after “blocked” (minutes)"], ["max", "Longest pause (minutes)"]] as const).map(([k, label]) => (
            <div className="field" key={k}>
              <label className="label" htmlFor={`p-${k}`}>{label}</label>
              <input id={`p-${k}`} className="input" inputMode="decimal" value={form[k]} placeholder={label.includes("minutes") ? "Minutes" : "Seconds"} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
        </div>
      </ModalForm>
    </div>
  )
}
