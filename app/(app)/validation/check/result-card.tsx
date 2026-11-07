import { X } from "lucide-react"

import { dayLabel, timeWithSeconds } from "@/lib/format"
import type { CheckResult } from "@/lib/types"
import { CATEGORIES, categoryMeta, duration } from "@/lib/validation"
import { CategoryPill } from "../category-pill"

/** The answer of one check: category, reason in plain words, the provider's own reply, and the SMTP conversation. */
export function ResultCard({ result, onClose }: { result: CheckResult | null; onClose: () => void }) {
  if (!result) {
    return (
      <div className="card card-pad">
        <p className="muted" style={{ margin: 0 }}>The result shows here: one of the six categories with the reason.</p>
        <ul className="small muted" style={{ margin: "10px 0 0", paddingLeft: 18 }}>
          {CATEGORIES.map((c) => <li key={c}><b>{categoryMeta(c).label}</b>: {categoryMeta(c).meaning}</li>)}
        </ul>
      </div>
    )
  }
  const r = result
  return (
    <div className="card" aria-live="polite">
      <div className="card-head">
        <h2 className="mono" style={{ fontSize: 15, wordBreak: "break-all" }}>{r.email}</h2>
        <span className="right"><button className="btn" onClick={onClose} aria-label="Close result"><X /></button></span>
      </div>
      <div className="card-pad">
        <CategoryPill category={r.category} style={{ fontSize: 14, padding: "5px 14px 5px 10px" }} />
        <p style={{ margin: "12px 0 16px", fontWeight: 500 }}>{r.reason}</p>
        <dl className="kv" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div style={{ gridColumn: "1 / -1" }}><dt>The provider said</dt><dd className="mono small" style={{ wordBreak: "break-word" }}>{r.reply || "—"}</dd></div>
          <div><dt>Mail server</dt><dd className="mono small" style={{ wordBreak: "break-all" }}>{r.mxHost || "—"}{r.smtpCode ? ` · ${r.smtpCode}` : ""}</dd></div>
          <div><dt>Through</dt><dd className="small">{r.serverName} <span className="mono muted">{r.serverIp}</span></dd></div>
          <div><dt>Greeting / sender</dt><dd className="mono small" style={{ wordBreak: "break-all" }}>{r.heloHost}<br />{r.mailFrom}</dd></div>
          <div><dt>When</dt><dd className="small">{dayLabel(r.createdAt)} {timeWithSeconds(r.createdAt)} · {duration(r.durationMs)}</dd></div>
        </dl>
        {r.transcript.length > 0 && (
          <details style={{ marginTop: 16 }}>
            <summary className="small" style={{ cursor: "pointer" }}>SMTP conversation ({r.transcript.length} lines)</summary>
            <pre className="mono" aria-label="SMTP conversation" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "var(--surface-2)",
              border: "1px solid var(--border)", borderRadius: 8, padding: 12, margin: "8px 0 0", fontSize: 12, maxHeight: 320, overflow: "auto" }}>
              {r.transcript.join("\n")}</pre>
          </details>
        )}
      </div>
    </div>
  )
}
