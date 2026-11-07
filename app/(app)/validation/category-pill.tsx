import { Ban, Check, CircleHelp, Inbox, RefreshCw, X } from "lucide-react"

import type { Category } from "@/lib/types"
import { categoryMeta } from "@/lib/validation"

const ICON: Record<Category, React.ComponentType> = {
  VALID: Check, BOUNCE: X, SOFT_BOUNCE: RefreshCw, REJECT: Ban, CATCH_ALL: Inbox, UNKNOWN: CircleHelp,
}

/** A validation category as a pill (approved palette + icon); its meaning is the tooltip. */
export function CategoryPill({ category, style }: { category: Category; style?: React.CSSProperties }) {
  const m = categoryMeta(category)
  const Icon = ICON[category] ?? CircleHelp
  return <span className={`pill ${m.tone}`} title={m.meaning} style={style}><Icon />{m.label}</span>
}
