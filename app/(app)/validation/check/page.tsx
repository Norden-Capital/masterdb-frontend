"use client"

import { MailSearch, SearchX, ShieldCheck, X } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { type Column, DataTable } from "@/components/md/data-table"
import { useSession } from "@/components/md/session"
import { EmptyState, ErrorState, Forbidden, LoadingState } from "@/components/md/states"
import { FieldError, PageWarning } from "@/components/md/ui"
import { useTableQuery } from "@/components/md/use-table-query"
import { api, ApiError, describe } from "@/lib/api"
import { dayLabel, timeWithSeconds } from "@/lib/format"
import { count } from "@/lib/table"
import type { CheckResult, ValidationServer } from "@/lib/types"
import { CATEGORIES, categoryMeta, looksLikeEmail } from "@/lib/validation"
import { SelectField } from "@/components/md/select-field"
import { CategoryPill } from "../category-pill"
import { ResultCard } from "./result-card"

/**
 * Validation: check one email now, through one server (used to test the
 * system). The check leaves from the server's IP and greets with its domain;
 * no message is sent. Every check goes into the history below (90 days).
 */
export default function EmailValidationPage() {
  const { can } = useSession()
  const [servers, setServers] = useState<ValidationServer[] | null>(null)
  const [serversError, setServersError] = useState<unknown>(null)
  const [email, setEmail] = useState("")
  const [serverId, setServerId] = useState("")
  const [busy, setBusy] = useState(false)
  const [emailError, setEmailError] = useState("")
  const [checkError, setCheckError] = useState<unknown>(null)
  const [shown, setShown] = useState<CheckResult | null>(null)
  const history = useTableQuery<CheckResult>({
    path: "/api/v1/validation/checks", enabled: can("VALIDATION:VIEW"), size: 10,
    filters: { category: "" }, sort: { field: "createdAt", dir: "desc" },
  })

  const loadServers = useCallback(() => {
    api<ValidationServer[]>("/api/v1/validation/servers").then((l) => {
      setServersError(null)
      setServers(l)
      setServerId((cur) => cur || l.find((s) => s.ready)?.publicId || "")
    }, setServersError)
  }, [])
  useEffect(() => {
    if (can("VALIDATION:VIEW")) loadServers()
  }, [can, loadServers])
  useEffect(() => { document.title = "Email validation · MasterDB" }, [])

  if (!can("VALIDATION:VIEW")) return <Forbidden module="Validation" />

  const ready = servers?.filter((s) => s.ready) ?? []
  const chosen = servers?.find((s) => s.publicId === serverId)
  const canRun = can("VALIDATION:RUN")

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setCheckError(null)
    if (!looksLikeEmail(email)) {
      setEmailError("Enter an email address, like jane@example.com.")
      return
    }
    setEmailError("")
    setBusy(true)
    try {
      const r = await api<CheckResult>("/api/v1/validation/checks", { method: "POST", body: { email: email.trim(), serverId } })
      setShown(r)
      history.reload()
    } catch (err) {
      if (err instanceof ApiError && err.fields.some((f) => f.field === "email")) setEmailError("This is not a valid email address.")
      else setCheckError(err)
    } finally {
      setBusy(false)
    }
  }

  const { category = "" } = history.filters
  const columns: Column<CheckResult>[] = [
    { key: "time", header: "Time", sortField: "createdAt", className: "cell2",
      render: (c) => <><b>{dayLabel(c.createdAt)}</b><span>{timeWithSeconds(c.createdAt)}</span></> },
    { key: "email", header: "Email", sortField: "email",
      render: (c) => <button className="link-btn mono" style={{ textAlign: "left", wordBreak: "break-all" }} onClick={() => setShown(c)}
        aria-label={`Show the check of ${c.email}`}>{c.email}</button> },
    { key: "category", header: "Result", sortField: "category", render: (c) => <CategoryPill category={c.category} /> },
    { key: "reason", header: "Reason", className: "small", render: (c) => c.reason },
    { key: "server", header: "Server", sortField: "serverName", className: "cell2",
      render: (c) => <><b>{c.serverName}</b><span className="mono">{c.serverIp}</span></> },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <h1>Email validation</h1>
        {servers && ready.length === 0 && (
          <PageWarning title="No server can validate yet">
          <p>A server needs to be connected over SSH and linked to a domain (that gives it its greeting name and sender
            address). {can("SERVERS:VIEW") && <Link href="/servers/list">Open the server list</Link>}</p>
          </PageWarning>
        )}
        <span className="meta">Check one address now, through one server. No email is sent.</span>
      </div>

      {serversError ? <ErrorState title="Couldn't load the servers" error={serversError} onRetry={loadServers} /> : null}
      {!servers && !serversError && <LoadingState />}

      {servers && ready.length > 0 && (
        <div className="grid-2" style={{ gap: 16, alignItems: "start", marginBottom: 24 }}>
          <form className="card card-pad" onSubmit={run} noValidate>
            <div className="field">
              <label className="label" htmlFor="v-email">Email address</label>
              <input id="v-email" className={`input mono ${emailError ? "invalid" : ""}`} type="email" autoComplete="off"
                placeholder="jane@example.com" value={email} disabled={busy}
                onChange={(e) => { setEmail(e.target.value); setEmailError("") }} />
              {emailError && <FieldError text={emailError} />}
            </div>
            <div className="field">
              <label className="label" htmlFor="v-server">Server</label>
              <SelectField id="v-server" className="input" value={serverId} disabled={busy} onChange={(e) => setServerId(e.target.value)}>
                {servers.map((s) => (
                  <option key={s.publicId} value={s.publicId} disabled={!s.ready}>
                    {s.name} · {s.ip}{s.ready ? "" : " (not ready)"}
                  </option>
                ))}
              </SelectField>
              {chosen && (chosen.ready
                ? <span className="small muted">Leaves from <span className="mono">{chosen.ip}</span>, greets as <span className="mono">{chosen.heloHost}</span>,
                  sender <span className="mono">{chosen.mailFrom}</span>.</span>
                : <span className="small text-danger">{chosen.reason}</span>)}
            </div>
            {canRun
              ? <button className="btn primary" type="submit" disabled={busy || !chosen?.ready}>
                <MailSearch className={busy ? "spin" : undefined} />{busy ? "Checking…" : "Check"}</button>
              : <p className="small muted" style={{ margin: 0 }}>You can see the history; checking needs the Validation run permission.</p>}
            {busy && <p className="small muted" style={{ margin: "10px 0 0" }}>Talking to the mail servers through {chosen?.name}. Slow mail servers can take up to a minute.</p>}
            {checkError ? <p className="small text-danger" role="alert" style={{ margin: "10px 0 0" }}>{describe(checkError)}</p> : null}
          </form>
          <ResultCard result={shown} onClose={() => setShown(null)} />
        </div>
      )}

      <div className="page-head" style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>History</h2>
        <span className="meta">{history.data ? `${count(history.data.totalItems)} checks · kept 90 days` : "Kept 90 days"}</span>
      </div>
      <DataTable
        filters={<>
        <SelectField className={`filter ${category ? "on" : ""}`} aria-label="Result" value={category}
          onChange={(e) => history.setFilter("category", e.target.value)}>
          <option value="">Result: All</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>Result: {categoryMeta(c).label}</option>)}
        </SelectField>
        {category && <button className="link-btn small" onClick={() => history.setFilter("category", "")}><X size={13} />Clear</button>}
        </>}
        table={history}
        label="Single checks"
        columns={columns}
        rowKey={(c) => c.publicId}
        rowClassName={(c) => c.publicId === shown?.publicId ? "selected" : undefined}
        search={{ placeholder: "Search by email", label: "Search checks" }}
        sizes={[10, 25, 50]}
        errorTitle="Couldn't load the history"
        empty={(d) => d.totalItems > 0 ? null : (
          history.filtered || category
            ? <EmptyState icon={<SearchX />} title="No check matches" text="Try another search or result." />
            : <EmptyState icon={<ShieldCheck />} title="No checks yet" text="Checks made above show up here." />
        )}
      />
    </div>
  )
}
