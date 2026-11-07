/** Shapes the backend answers with (see masterdb-backend README). */

export type Me = {
  publicId: string
  email: string
  fullName: string
  isOwner: boolean
  /** Effective permissions, MODULE:ACTION (all of them for the Owner). */
  permissions: string[]
}

export type LoginState = "TWO_FACTOR_REQUIRED" | "TWO_FACTOR_SETUP_REQUIRED" | "AUTHENTICATED"

export type LoginResponse = { state: LoginState; user?: Me; recoveryCodes?: string[] }

export type UserStatus = "ACTIVE" | "INVITED" | "DISABLED"

export type UserItem = {
  publicId: string
  email: string
  fullName: string
  status: UserStatus
  isOwner: boolean
  twoFactorEnabled: boolean
  locked: boolean
  lastLoginAt?: string
  createdAt: string
  inviteExpiresAt?: string
  permissionCount: number
}

export type Page<T> = { items: T[]; page: number; size: number; totalItems: number; totalPages: number }

export type SessionView = {
  publicId: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  ip?: string
  userAgent?: string
  current: boolean
}

export type UserDetail = {
  user: UserItem
  permissions: string[]
  recoveryCodesRemaining: number
  sessions: SessionView[]
}

export type Catalogue = {
  modules: { key: string; label: string; actions: { key: string; label: string }[] }[]
  actions: { key: string; label: string }[]
  templates: { key: string; label: string; description: string; permissions: string[] }[]
}

export type ActivityEntry = {
  id: number
  occurredAt: string
  action: string
  actorPublicId?: string
  actorLabel?: string
  targetPublicId?: string
  targetLabel?: string
  ip?: string
  userAgent?: string
  requestId?: string
  details: Record<string, unknown>
}

/** GET /api/v1/dashboard/summary: counted from the database at the call. */
export type DashboardSummary = {
  generatedAt: string
  users: { total: number; active: number; invited: number; disabled: number }
  openSessions: number
  activity: { last24Hours: number; last7Days: number }
}

/** GET /api/v1/dns/namecheap/account. The API key is never sent back, only `apiKeySet`. */
export type NamecheapAccount = {
  configured: boolean
  apiUser?: string
  username?: string
  apiKeySet: boolean
  /** The IP this server sends as ClientIp; it must be whitelisted in Namecheap. */
  clientIp: string
  createdAt?: string
  updatedAt?: string
  lastTest?: { at: string; ok: boolean; message: string }
}

export type NamecheapTestResult = { ok: boolean; code?: string; message: string; domainCount?: number }

export type DomainSource = "MANUAL" | "NAMECHEAP"
export type HealthStatus = "OK" | "PROBLEM" | "ERROR"

/** GET /api/v1/dns/domains (one row) and /api/v1/dns/domains/{id}. */
export type DomainItem = {
  publicId: string
  name: string
  source: DomainSource
  /** Namecheap metadata (dates as YYYY-MM-DD); absent for manual domains. */
  registeredAt?: string
  expiresAt?: string
  expired?: boolean
  autoRenew?: boolean
  locked?: boolean
  usesNamecheapDns?: boolean
  namecheapSyncedAt?: string
  /** Absent = never checked. */
  healthStatus?: HealthStatus
  healthCheckedAt?: string
  createdAt: string
  updatedAt: string
}

/** GET /api/v1/dns/namecheap/domains: one domain of the Namecheap account. */
export type AccountDomain = {
  name: string
  expiresAt?: string
  expired: boolean
  autoRenew: boolean
  locked: boolean
  usesNamecheapDns: boolean
  alreadyAdded: boolean
}

export type ImportResult = { added: string[]; updated: string[]; skipped: string[] }

/** The records MasterDB manages for a domain (A, MX, SPF, DKIM, DMARC, BIMI) and what health checks expect. */
export type DnsSettings = {
  mailIp?: string
  dkimSelector: string
  dkimPublicKey?: string
  dmarcPolicy: "none" | "quarantine" | "reject"
  bimiLogoUrl?: string
  bimiCertificateUrl?: string
  updatedAt?: string
}

/** One host record as Namecheap has it. */
export type HostRecord = { name: string; type: string; address: string; mxPref?: string; ttl: string }

export type RecordChange = { change: "ADD" | "REMOVE" | "KEEP"; managed: boolean; record: HostRecord }

/** Before/after of a write to Namecheap (setup or restore). `token` must be sent back to write. */
export type RecordPlan = {
  domain: string
  emailType: string
  token: string
  changes: RecordChange[]
  before: HostRecord[]
  after: HostRecord[]
  warnings: string[]
}

export type WriteResult = { verified: boolean; missing: HostRecord[]; snapshotId: string }

export type DnsSnapshot = {
  publicId: string
  createdAt: string
  actorLabel?: string
  reason: "BEFORE_SETUP" | "BEFORE_RESTORE"
  emailType: string
  recordCount: number
  records?: HostRecord[]
}
