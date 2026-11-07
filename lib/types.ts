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
