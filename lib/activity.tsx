import {
  CircleAlert, CircleSlash, CloudDownload, Download, Globe, Trash2, KeyRound, PlugZap, LockKeyhole, LogIn, LogOut, Mail, MailCheck, MailX, RotateCcw,
  Send, ShieldCheck, SlidersHorizontal, UserPlus,
} from "lucide-react"

import type { ActivityEntry } from "@/lib/types"

type Meta = { label: string; icon: React.ComponentType<{ size?: number }>; failed?: boolean }

/** How each backend ActivityAction reads on screen. */
export const ACTIONS: Record<string, Meta> = {
  LOGIN_SUCCEEDED: { label: "Logged in", icon: LogIn },
  LOGIN_FAILED: { label: "Login attempt", icon: LogIn, failed: true },
  ACCOUNT_LOCKED: { label: "Account locked", icon: LockKeyhole, failed: true },
  LOGOUT: { label: "Logged out", icon: LogOut },
  TWO_FACTOR_ENROLLED: { label: "Set up two-factor", icon: ShieldCheck },
  TWO_FACTOR_RESET: { label: "Reset two-factor", icon: KeyRound },
  RECOVERY_CODE_USED: { label: "Used a recovery code", icon: KeyRound },
  RECOVERY_CODES_REGENERATED: { label: "New recovery codes", icon: KeyRound },
  USER_INVITED: { label: "Invited user", icon: UserPlus },
  INVITE_RESENT: { label: "Resent invite", icon: Send },
  INVITE_CANCELLED: { label: "Cancelled invite", icon: MailX },
  INVITE_ACCEPTED: { label: "Accepted invite", icon: MailCheck },
  USER_DISABLED: { label: "Disabled user", icon: CircleSlash },
  USER_ENABLED: { label: "Enabled user", icon: RotateCcw },
  PERMISSIONS_CHANGED: { label: "Changed permissions", icon: SlidersHorizontal },
  PASSWORD_CHANGED: { label: "Changed password", icon: LockKeyhole },
  PASSWORD_RESET_REQUESTED: { label: "Asked for a password reset", icon: Mail },
  PASSWORD_RESET: { label: "Reset password", icon: LockKeyhole },
  SESSION_REVOKED: { label: "Ended a session", icon: LogOut },
  SESSIONS_REVOKED: { label: "Ended sessions", icon: LogOut },
  ACTIVITY_EXPORTED: { label: "Exported the activity log", icon: Download },
  NAMECHEAP_ACCOUNT_SAVED: { label: "Saved the Namecheap account", icon: Globe },
  NAMECHEAP_ACCOUNT_REMOVED: { label: "Removed the Namecheap account", icon: Globe },
  NAMECHEAP_CONNECTION_TESTED: { label: "Tested the Namecheap connection", icon: PlugZap },
  DOMAIN_ADDED: { label: "Added a domain", icon: Globe },
  DOMAINS_IMPORTED: { label: "Imported domains from Namecheap", icon: CloudDownload },
  DOMAIN_DELETED: { label: "Deleted a domain", icon: Trash2 },
}

export function actionMeta(action: string): Meta {
  return ACTIONS[action] ?? { label: action.toLowerCase().replace(/_/g, " "), icon: CircleAlert }
}

const REASONS: Record<string, string> = {
  wrong_password: "Wrong password",
  unknown_account: "No such account",
  unknown_account_locked: "No such account (locked)",
  account_disabled: "Account disabled",
  account_invited: "Invite not accepted yet",
  account_locked: "Account was locked",
  "2fa_code": "Wrong two-factor code",
  current_password_wrong: "Wrong current password",
}

/** The short second line under the target (mock 12 "Target" column). */
export function detailLine(e: ActivityEntry): string {
  const d = e.details ?? {}
  const dns = dnsDetail(e.action, d)
  if (dns !== null) return dns
  if (typeof d.reason === "string") return REASONS[d.reason] ?? d.reason
  if (Array.isArray(d.added) || Array.isArray(d.removed)) {
    const add = (d.added as string[] | undefined) ?? []
    const rem = (d.removed as string[] | undefined) ?? []
    return [...add.map((p) => `+ ${p}`), ...rem.map((p) => `− ${p}`)].join(", ") || "No change"
  }
  if (typeof d.sessionsEnded === "number") return `${d.sessionsEnded} session${d.sessionsEnded === 1 ? "" : "s"} ended`
  if (typeof d.count === "number") return `${d.count} session${d.count === 1 ? "" : "s"}`
  if (typeof d.rows === "number") return `${d.rows} rows`
  if (typeof d.remaining === "number") return `${d.remaining} codes left`
  if (Array.isArray(d.permissions)) return `${d.permissions.length} permissions`
  return ""
}

/** DNS module entries (backend dns/ package); null for any other action. */
function dnsDetail(action: string, d: Record<string, unknown>): string | null {
  switch (action) {
    case "NAMECHEAP_ACCOUNT_SAVED":
      return `${d.added ? "Added" : "Changed"} · API user ${String(d.apiUser ?? "")} · key ${d.keyReplaced ? "set" : "kept"}`
    case "NAMECHEAP_CONNECTION_TESTED":
      return d.ok ? "Connected" : NAMECHEAP_ERRORS[String(d.code)] ?? "Failed"
    case "DOMAIN_ADDED":
      return "By hand"
    case "DOMAIN_DELETED":
      return d.source === "NAMECHEAP" ? "Was from Namecheap" : "Was added by hand"
    case "DOMAINS_IMPORTED":
      return `${Number(d.addedCount ?? 0)} added, ${Number(d.updatedCount ?? 0)} refreshed`
    default:
      return null
  }
}

/** Short names of the Namecheap error codes (backend ErrorCode). */
export const NAMECHEAP_ERRORS: Record<string, string> = {
  NAMECHEAP_IP_NOT_WHITELISTED: "IP not whitelisted",
  NAMECHEAP_INVALID_KEY: "API key or user refused",
  NAMECHEAP_ERROR: "Namecheap error",
  NAMECHEAP_UNREACHABLE: "Namecheap not reachable",
  NAMECHEAP_NOT_CONFIGURED: "No Namecheap account",
}
