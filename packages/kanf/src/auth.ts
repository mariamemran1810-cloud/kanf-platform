import { createHash, randomBytes, pbkdf2Sync, timingSafeEqual } from "node:crypto"
import { all, get, id, now, run } from "./db"

/**
 * مفتاح توقيع الجلسات.
 * - إذا عُرّض KANF_SECRET يُستخدم (موصى به في الإنتاج).
 * - وإلا يُولَّد مرة واحدة ويُحفظ في قاعدة البيانات،
 *   حتى لا تُبطل إعادة تشغيل الخادم جلسات المستخدمين.
 */
function loadSecret(): string {
  const fromEnv = process.env.KANF_SECRET
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim()

  const stored = get<{ value: string }>(`SELECT value FROM settings WHERE key = 'session_secret'`)?.value
  if (stored && stored.length > 0) return stored

  const generated = randomBytes(32).toString("hex")
  run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('session_secret', ?)`, generated)
  return generated
}

const SECRET = loadSecret()
const SESSION_TTL = 1000 * 60 * 60 * 24 * 30 // 30 يوماً

export type Role = "owner" | "admin" | "member"
export type User = {
  id: string
  email: string
  name: string
  password_hash: string
  password_salt: string
  role: Role
  plan: string
  status: string
  locale: string
  avatar_color: string
  created_at: number
  last_login_at: number | null
}

const ROLE_RANK: Record<Role, number> = { member: 1, admin: 2, owner: 3 }

export function hashPassword(password: string, salt?: string) {
  const s = salt ?? randomBytes(16).toString("hex")
  const hash = pbkdf2Sync(password, s, 200_000, 32, "sha256").toString("hex")
  return { hash, salt: s }
}

export function verifyPassword(password: string, hash: string, salt: string) {
  const candidate = Buffer.from(hashPassword(password, salt).hash, "hex")
  const expected = Buffer.from(hash, "hex")
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

function sign(value: string) {
  return createHash("sha256").update(`${value}.${SECRET}`).digest("base64url")
}

export function createSession(user: User, ip?: string, ua?: string) {
  const token = randomBytes(32).toString("base64url")
  const tokenHash = sign(token)
  const expires = now() + SESSION_TTL
  run(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    tokenHash,
    user.id,
    now(),
    expires,
    ip ?? null,
    ua ?? null,
  )
  return { token, expires }
}

export function destroySession(token: string) {
  run(`DELETE FROM sessions WHERE token_hash = ?`, sign(token))
}

export function userFromToken(token: string | undefined): User | undefined {
  if (!token) return undefined
  const row = get<{ user_id: string; expires_at: number }>(
    `SELECT user_id, expires_at FROM sessions WHERE token_hash = ?`,
    sign(token),
  )
  if (!row) return undefined
  if (row.expires_at < now()) {
    run(`DELETE FROM sessions WHERE token_hash = ?`, sign(token))
    return undefined
  }
  return get<User>(`SELECT * FROM users WHERE id = ?`, row.user_id)
}

export function createUser(input: {
  email: string
  name: string
  password: string
  role?: Role
  plan?: string
  locale?: string
}): User {
  const { hash, salt } = hashPassword(input.password)
  const userId = id("usr")
  const color = avatarColorFor(input.email)
  run(
    `INSERT INTO users (id, email, name, password_hash, password_salt, role, plan, locale, avatar_color, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    userId,
    input.email.toLowerCase().trim(),
    input.name.trim(),
    hash,
    salt,
    input.role ?? "member",
    input.plan ?? "trial",
    input.locale ?? "ar",
    color,
    now(),
  )
  run(
    `INSERT INTO subscriptions (id, user_id, plan, status, price, started_at, renews_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?)`,
    id("sub"),
    userId,
    input.plan ?? "trial",
    planPrice(input.plan ?? "trial"),
    now(),
    now() + 1000 * 60 * 60 * 24 * 14,
  )
  return get<User>(`SELECT * FROM users WHERE id = ?`, userId)!
}

export function can(actor: User | undefined, required: Role): boolean {
  if (!actor) return false
  if (actor.status !== "active") return false
  return ROLE_RANK[actor.role] >= ROLE_RANK[required]
}

export function logActivity(
  userId: string | null,
  action: string,
  target = "",
  meta: Record<string, unknown> = {},
) {
  run(
    `INSERT INTO activity (id, user_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    id("act"),
    userId,
    action,
    target,
    JSON.stringify(meta),
    now(),
  )
}

export function planPrice(plan: string) {
  return { trial: 0, pro: 4900, enterprise: 19900 }[plan] ?? 0
}

function avatarColorFor(email: string) {
  const palette = ["#0f766e", "#7c3aed", "#b45309", "#be123c", "#1d4ed8", "#047857", "#a21caf"]
  let sum = 0
  for (const ch of email) sum += ch.charCodeAt(0)
  return palette[sum % palette.length]
}

export function activeUserCount() {
  return get<{ c: number }>(`SELECT COUNT(*) c FROM users WHERE status = 'active'`)?.c ?? 0
}

export function userSessions(userId: string) {
  return all<{ created_at: number; expires_at: number; ip: string | null; user_agent: string | null }>(
    `SELECT created_at, expires_at, ip, user_agent FROM sessions WHERE user_id = ? ORDER BY created_at DESC`,
    userId,
  )
}
