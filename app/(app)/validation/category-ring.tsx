import { percent } from "@/lib/poll"
import { count } from "@/lib/table"
import type { Category } from "@/lib/types"
import { CATEGORIES, categoryMeta, ringSegments } from "@/lib/validation"

/** Solid category colours (design direction 2.2). */
const SOLID: Record<Category, string> = {
  VALID: "#43A838", BOUNCE: "#E5484D", SOFT_BOUNCE: "#C47F0A", REJECT: "#8E4EC6", CATCH_ALL: "#1A9C9C", UNKNOWN: "#8B95A3",
}

/**
 * The live round chart of a job: one segment per category in the fixed order,
 * sized by count / total exactly as the server reported; the empty rest is
 * what is still to check. Centre: % checked and "x of y". Next to it, one bar
 * per category with its count. No easing, no estimate.
 */
export function CategoryRing({ counts, total, checked, size = 160 }: {
  counts: Record<Category, number>
  total: number
  checked: number
  size?: number
}) {
  const stroke = 14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = percent(checked, total)
  const segs = ringSegments(counts, total)
  return (
    <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
      <div className="pring" style={{ width: size, height: size }} role="progressbar" aria-label="Addresses checked"
        aria-valuemin={0} aria-valuemax={total} aria-valuenow={checked}
        aria-valuetext={`${count(checked)} of ${count(total)} checked (${pct ?? 0}%)`}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
          {segs.map((s) => (
            <circle key={s.category} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={SOLID[s.category]} strokeWidth={stroke}
              strokeDasharray={`${c * s.length} ${c}`} strokeDashoffset={-c * s.start}
              transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          ))}
        </svg>
        <div className="pring-center">
          <b className="num">{pct ?? 0}%</b>
          <span className="num">{count(checked)} of {count(total)}</span>
        </div>
      </div>
      <div style={{ flex: "1 1 220px", display: "grid", gap: 8, minWidth: 0 }}>
        {CATEGORIES.map((cat) => {
          const n = counts[cat] ?? 0
          const m = categoryMeta(cat)
          return (
            <div key={cat} title={m.meaning}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span><span aria-hidden="true" style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: SOLID[cat], marginRight: 6 }} />{m.label}</span>
                <b className="num">{count(n)}</b>
              </div>
              <div style={{ height: 6, background: "var(--track)", borderRadius: 3, overflow: "hidden", marginTop: 3 }}>
                <div style={{ height: 6, width: `${total > 0 ? (n / total) * 100 : 0}%`, background: SOLID[cat] }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
