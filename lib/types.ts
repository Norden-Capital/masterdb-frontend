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
  /** A linked server (Server management): mailIp is its IP and can't be typed. */
  mailServer?: { publicId: string; name: string; ip: string }
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

export type RecordHealth = {
  record: "A" | "MX" | "SPF" | "DKIM" | "DMARC" | "BIMI" | "PTR"
  status: "OK" | "PROBLEM" | "ERROR" | "NOT_CHECKED"
  detail: string
  expected?: string
  found?: string
}

/** GET /api/v1/dns/domains/{id}/health; `records` empty = never checked. */
export type HealthReport = { domain: string; status?: HealthStatus; checkedAt?: string; records: RecordHealth[] }

// ---- Server management ----------------------------------------------------------

export type ConnectionStatus = "NEW" | "KEY_PENDING" | "CONNECTED" | "AUTH_FAILED" | "UNREACHABLE" | "KEY_CHANGED"

/** A host key: the trusted one (`at` = when pinned) or one the server showed (`at` = when seen). */
export type KeyView = { type: string; fingerprint: string; at?: string }

/** GET /api/v1/servers (one row) and /api/v1/servers/{id}. */
export type ServerItem = {
  publicId: string
  name: string
  ip: string
  sshPort: number
  sshUser: string
  /** YYYY-MM-DD. */
  expiresOn: string
  /** Days from today (UTC) to expiresOn; negative when past. */
  daysLeft: number
  notes?: string
  domain?: { publicId: string; name: string }
  connectionStatus: ConnectionStatus
  connectionMessage?: string
  connectionCheckedAt?: string
  hostKey?: KeyView
  presentedKey?: KeyView
  os?: string
  privileged?: boolean
  /** Absent = never checked. */
  healthStatus?: ServerHealthStatus
  healthCheckedAt?: string
  /** Probe identity on the linked domain (present only while a domain is linked). */
  heloHost?: string
  mailFrom?: string
  createdAt: string
  updatedAt: string
}

export type ServerHealthStatus = "OK" | "WARNING" | "PROBLEM" | "ERROR"

export type ServerCheck = {
  check: "SSH" | "PORT25" | "PTR" | "DNSBL" | "EXPIRY"
  status: ServerHealthStatus | "NOT_CHECKED"
  detail: string
  found?: string
}

/** GET /api/v1/servers/{id}/health; `checks` empty = never checked. */
export type ServerHealthReport = { serverId: string; status?: ServerHealthStatus; checkedAt?: string; checks: ServerCheck[] }

/** GET /api/v1/servers/ssh-key: MasterDB's public key (the private key never leaves the backend). */
export type SshPublicKey = { publicKey: string; fingerprint: string; installCommand: string; createdAt: string }

/** POST /api/v1/servers/{id}/connect, /host-key/trust, /host-key/replace. */
export type ConnectResult = { outcome: ConnectionStatus; message?: string; server: ServerItem }

// ---- MTA ---------------------------------------------------------------------------

export type InstallStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "INTERRUPTED"

export type InstallStep = { key: string; label: string; state: "DONE" | "RUNNING" | "FAILED" | "PENDING" }

/** GET /api/v1/mta/installs/{id}?logFrom=n: `log` is the part from `logFrom`; `logLength` is the next logFrom. */
export type MtaInstall = {
  publicId: string
  serverId: string
  serverName?: string
  domain: string
  domainId?: string
  heloHost: string
  webmail: boolean
  webmailLogin?: string
  status: InstallStatus
  stepsDone: number
  stepsTotal: number
  currentStep?: string
  error?: string
  steps: InstallStep[]
  log: string
  logLength: number
  logFrom: number
  dkimSelector: string
  dkimPublicKey?: string
  startedBy?: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
}

/** GET /api/v1/mta/candidates: can this server get an MTA now, and if not, why. */
export type MtaCandidate = {
  publicId: string
  name: string
  ip: string
  os?: string
  domain?: string
  heloHost?: string
  ready: boolean
  reason?: string
  mtaInstalledAt?: string
  lastInstallId?: string
  lastInstallStatus?: InstallStatus
}

export type MtaServiceState = { name: "postfix" | "dovecot" | "opendkim"; state: string }

/** GET /api/v1/mta/servers (one row): a server's MTA with the last status read over SSH. */
export type MtaItem = {
  serverId: string
  name: string
  ip: string
  domain?: string
  heloHost?: string
  installedAt: string
  webmail: boolean
  status?: { services: MtaServiceState[]; versions: Record<string, string>; queue?: number }
  checkedAt?: string
  message?: string
  connectionStatus: ConnectionStatus
}

export type MtaLogView = { source: string; lines: number; text: string; readAt: string }

export type MtaQueueEntry = { queueId: string; queue: string; arrivedAt?: string; size: number; sender: string; recipients: number; reason?: string }

export type MtaQueue = { count: number; entries: MtaQueueEntry[]; readAt: string }
