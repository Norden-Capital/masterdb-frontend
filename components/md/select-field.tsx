"use client"

import { Children, isValidElement } from "react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Option = { value: string; label: React.ReactNode; disabled?: boolean }

/** base-ui keeps "" for "nothing chosen"; our "All" / "None" options use "", so they get a stand-in. */
const EMPTY = "__empty__"
const inner = (v: string) => (v === "" ? EMPTY : v)
const outer = (v: string) => (v === EMPTY ? "" : v)

function textOf(node: React.ReactNode): string {
  return Children.toArray(node).map((n) => (typeof n === "string" || typeof n === "number" ? String(n) : "")).join("")
}

/** The `<option>`s among the children, also inside fragments and mapped arrays. */
function optionsOf(children: React.ReactNode): Option[] {
  return Children.toArray(children).flatMap((c): Option[] => {
    if (!isValidElement(c)) return []
    const p = c.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean }
    if (c.type === "option") return [{ value: String(p.value ?? textOf(p.children)), label: p.children, disabled: p.disabled }]
    return optionsOf(p.children)
  })
}

/**
 * The shadcn Select (base-ui) with a native `<select>`'s props: `<option>`
 * children, `value`, and `onChange` reading `e.target.value`, so every select
 * in the app uses it the same way. `className` styles the trigger (md.css
 * `filter` / `input`, plus `on` / `invalid`).
 */
export function SelectField(props: {
  value: string | number
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
  children: React.ReactNode
  id?: string
  className?: string
  style?: React.CSSProperties
  disabled?: boolean
  "aria-label"?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}) {
  const options = optionsOf(props.children)
  const items = options.map((o) => ({ value: inner(o.value), label: o.label }))
  const invalid = props["aria-invalid"] ?? /\binvalid\b/.test(props.className ?? "")
  return (
    <Select
      value={inner(String(props.value ?? ""))}
      items={items}
      disabled={props.disabled}
      onValueChange={(v) => {
        const value = outer(String(v ?? ""))
        props.onChange?.({ target: { value }, currentTarget: { value } } as unknown as React.ChangeEvent<HTMLSelectElement>)
      }}
    >
      <SelectTrigger id={props.id} className={`md-select ${props.className ?? ""}`} style={props.style}
        aria-label={props["aria-label"]} aria-invalid={invalid || undefined} aria-describedby={props["aria-describedby"]}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="md-select-menu">
        {options.map((o) => (
          <SelectItem key={o.value} value={inner(o.value)} disabled={o.disabled}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
