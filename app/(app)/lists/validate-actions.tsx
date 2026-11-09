"use client"

import { ShieldCheck } from "lucide-react"
import Link from "next/link"

import { useSession } from "@/components/md/session"
import type { ListItem, ListPart } from "@/lib/lists"

/** Validating a list needs both Validation run and Lists run (the server checks again). */
function useCanValidate(): boolean {
  const { can } = useSession()
  return can("VALIDATION:RUN") && can("LISTS:RUN")
}

/** "Validate" on a list: opens Bulk validation with the list chosen (servers are picked there). */
export function ValidateListButton({ list, small }: { list: ListItem; small?: boolean }) {
  const allowed = useCanValidate()
  if (!allowed || list.status !== "READY" || list.validation?.running) return null
  return (
    <Link className={`btn ${small ? "sm" : "primary"}`} href={`/validation/bulk?list=${list.publicId}`}>
      <ShieldCheck />Validate
    </Link>
  )
}

/** "Validate" on one part of a list. */
export function PartActions({ list, part }: { list: ListItem; part: ListPart }) {
  const allowed = useCanValidate()
  if (!allowed || part.running) return null
  return (
    <Link className="btn sm" href={`/validation/bulk?list=${list.publicId}&part=${part.partNo}`} style={{ marginRight: 6 }}>
      <ShieldCheck />Validate part {part.partNo}
    </Link>
  )
}
