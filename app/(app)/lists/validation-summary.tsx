import Link from "next/link"

import { type ListItem, type RunningJob, validatedCount } from "@/lib/lists"
import { percent } from "@/lib/poll"
import { count } from "@/lib/table"
import type { Category } from "@/lib/types"
import { CATEGORIES, categoryMeta } from "@/lib/validation"

/** A validation job running on a list or part: its real progress, with a link to it. */
export function RunningBadge({ job }: { job: RunningJob }) {
  const pct = percent(job.checked, job.total)
  return (
    <Link className="pill blue" href={`/validation/results/${job.publicId}`} title="Open the validation job">
      {job.status === "PREPARING" ? "Preparing validation" : `Validating ${pct ?? 0}% · ${count(job.checked)} of ${count(job.total)}`}
    </Link>
  )
}

/**
 * The list's latest validation results (newest answer per address over all
 * its jobs), in the fixed category order, or the job running now.
 */
export function ValidationSummary({ list, compact }: { list: ListItem; compact?: boolean }) {
  const v = list.validation
  if (v?.running) return <RunningBadge job={v.running} />
  const counts = v?.counts
  const total = validatedCount(counts)
  if (!counts || total === 0) return <span className="muted">Not validated</span>
  const shown = CATEGORIES.filter((c) => (counts[c as Category] ?? 0) > 0)
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }} title={`${count(total)} addresses validated`}>
      {shown.map((c) => {
        const m = categoryMeta(c)
        return <span key={c} className={`pill ${m.tone}`}>{compact ? "" : `${m.label} `}{count(counts[c] ?? 0)}</span>
      })}
    </span>
  )
}
