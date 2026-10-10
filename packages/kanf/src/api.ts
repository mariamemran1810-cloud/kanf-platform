import { all, get, id, now, run } from "./db"
import {
  can,
  createSession,
  createUser,
  destroySession,
  hashPassword,
  logActivity,
  userFromToken,
  verifyPassword,
  type User,
} from "./auth"
import * as agent from "./agent"
import { dict, type Locale } from "./i18n"

const COOKIE = "kanf_session"

export function readToken(req: Request) {
  const header = req.headers.get("cookie") ?? ""
  const match = header.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))
  return match?.[1]
}

export function currentUser(req: Request) {
  return userFromToken(readToken(req))
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  })
}

function cookie(token: string, maxAge: number) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
}

export function publicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    plan: u.plan,
    status: u.status,
    locale: u.locale,
    avatar_color: u.avatar_color,
    created_at: u.created_at,
    last_login_at: u.last_login_at,
  }
}

export function localeOf(u: User | undefined, req: Request): Locale {
  const q = new URL(req.url).searchParams.get("lang")
  if (q === "ar" || q === "en") return q
  if (u?.locale === "ar" || u?.locale === "en") return u.locale
  return "ar"
}

type Ctx = { user?: User; body: any; params: URLSearchParams; req: Request }

/** ظٹط¹ظٹط¯ ظ‚ط§ط¦ظ…ط© [method, path, handler] */
export const routes: [string, string, (ctx: Ctx) => Promise<Response> | Response][] = [
  // ---------- ط§ظ„ظ…طµط§ط¯ظ‚ط© ----------
  ["POST", "/api/auth/signup", async ({ body, req }) => {
    if (!body?.email || !body?.password || !body?.name) return json({ error: "errorRequired" }, 400)
    if (String(body.password).length < 8) return json({ error: "passwordShort" }, 400)
    if (get(`SELECT id FROM users WHERE email = ?`, String(body.email).toLowerCase()))
      return json({ error: "errorExists" }, 409)
    const user = createUser({
      email: String(body.email),
      name: String(body.name),
      password: String(body.password),
      role: "member",
      plan: "trial",
      locale: body.locale === "en" ? "en" : "ar",
    })
    logActivity(user.id, "auth.signup", user.email)
    const { token, expires } = createSession(user, req.headers.get("x-forwarded-for") ?? undefined, req.headers.get("user-agent") ?? undefined)
    run(`UPDATE users SET last_login_at = ? WHERE id = ?`, now(), user.id)
    return json({ user: publicUser(user), t: dict(user.locale).dashboard }, 201, {
      "set-cookie": cookie(token, Math.floor((expires - now()) / 1000)),
    })
  }],

  ["POST", "/api/auth/login", async ({ body, req }) => {
    if (!body?.email || !body?.password) return json({ error: "errorRequired" }, 400)
    const user = get<User>(`SELECT * FROM users WHERE email = ?`, String(body.email).toLowerCase())
    if (!user || !verifyPassword(String(body.password), user.password_hash, user.password_salt))
      return json({ error: "errorCredentials" }, 401)
    if (user.status !== "active") return json({ error: "errorSuspended" }, 403)
    const { token, expires } = createSession(user, req.headers.get("x-forwarded-for") ?? undefined, req.headers.get("user-agent") ?? undefined)
    run(`UPDATE users SET last_login_at = ? WHERE id = ?`, now(), user.id)
    logActivity(user.id, "auth.login", user.email)
    return json({ user: publicUser(user) }, 200, {
      "set-cookie": cookie(token, Math.floor((expires - now()) / 1000)),
    })
  }],

  ["POST", "/api/auth/logout", ({ user, req }) => {
    const t = readToken(req)
    if (t) destroySession(t)
    if (user) logActivity(user.id, "auth.logout", user.email)
    return json({ ok: true }, 200, { "set-cookie": `${COOKIE}=; Path=/; HttpOnly; Max-Age=0` })
  }],

  ["GET", "/api/me", ({ user, req }) => {
    if (!user) return json({ error: "unauthorized" }, 401)
    return json({ user: publicUser(user), strings: dict(localeOf(user, req)) })
  }],

  ["PATCH", "/api/me", async ({ user, body }) => {
    if (!user) return json({ error: "unauthorized" }, 401)
    if (body?.name) run(`UPDATE users SET name = ? WHERE id = ?`, String(body.name), user.id)
    if (body?.locale === "ar" || body?.locale === "en")
      run(`UPDATE users SET locale = ? WHERE id = ?`, body.locale, user.id)
    if (body?.password) {
      if (String(body.password).length < 8) return json({ error: "passwordShort" }, 400)
      const { hash, salt } = hashPassword(String(body.password))
      run(`UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?`, hash, salt, user.id)
      logActivity(user.id, "user.password", user.email)
    }
    if (body?.avatar_color) run(`UPDATE users SET avatar_color = ? WHERE id = ?`, String(body.avatar_color), user.id)
    const fresh = get<User>(`SELECT * FROM users WHERE id = ?`, user.id)!
    logActivity(user.id, "user.update", user.email)
    return json({ user: publicUser(fresh) })
  }],

  // ---------- ط§ظ„ظ…ط´ط§ط±ظٹط¹ ----------
  ["GET", "/api/projects", ({ user }) => {
    if (!user) return json({ error: "unauthorized" }, 401)
    return json({ projects: all(`SELECT * FROM projects ORDER BY updated_at DESC`) })
  }],

  ["POST", "/api/projects", async ({ user, body }) => {
    if (!user) return json({ error: "unauthorized" }, 401)
    if (!body?.name) return json({ error: "errorRequired" }, 400)
    const projectId = id("prj")
    run(
      `INSERT INTO projects (id, owner_id, name, description, status, language, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
      projectId,
      user.id,
      String(body.name),
      String(body.description ?? ""),
      String(body.language ?? "typescript"),
      now(),
      now(),
    )
    logActivity(user.id, "project.create", String(body.name))
    return json({ project: get(`SELECT * FROM projects WHERE id = ?`, projectId) }, 201)
  }],

  ["PATCH", "/api/projects/:id", async ({ user, body, params }) => {
    if (!user) return json({ error: "unauthorized" }, 401)
    const p = get<{ id: string; owner_id: string }>(`SELECT * FROM projects WHERE id = ?`, params.get("id")!)
    if (!p) return json({ error: "notFound" }, 404)
    if (p.owner_id !== user.id && !can(user, "admin")) return json({ error: "errorPermission" }, 403)
    const name = body?.name ? String(body.name) : null
    const description = body?.description != null ? String(body.description) : null
    const status = body?.status ? String(body.status) : null
    if (name) run(`UPDATE projects SET name = ? WHERE id = ?`, name, p.id)
    if (description != null) run(`UPDATE projects SET description = ? WHERE id = ?`, description, p.id)
    if (status && ["active", "archived"].includes(status))
      run(`UPDATE projects SET status = ? WHERE id = ?`, status, p.id)
    run(`UPDATE projects SET updated_at = ? WHERE id = ?`, now(), p.id)
    logActivity(user.id, "project.update", p.id)
    return json({ project: get(`SELECT * FROM projects WHERE id = ?`, p.id) })
  }],

  ["DELETE", "/api/projects/:id", ({ user, params }) => {
    if (!user) return json({ error: "unauthorized" }, 401)
    const p = get<{ id: string; owner_id: string; name: string }>(`SELECT * FROM projects WHERE id = ?`, params.get("id")!)
    if (!p) return json({ error: "notFound" }, 404)
    if (p.owner_id !== user.id && !can(user, "admin")) return json({ error: "errorPermission" }, 403)
    run(`DELETE FROM projects WHERE id = ?`, p.id)
    logActivity(user.id, "project.delete", p.name)
    return json({ ok: true })
  }],

  // ---------- ط§ظ„ظˆظƒظٹظ„ ----------
  ["GET", "/api/agent/sessions", ({ user, req }) => {
    if (!user) return json({ error: "unauthorized" }, 401)
    return json({
      sessions: agent.agentSessions(user.id),
      model: agent.defaultModel(),
      live: agent.modelAvailable(),
      strings: dict(localeOf(user, req)),
    })
  }],

  ["POST", "/api/agent/sessions", async ({ user, body }) => {
    if (!user) return json({ error: "unauthorized" }, 401)
    const sid = agent.createAgentSession(user, body?.project_id, String(body?.title ?? "ط³ط§ط­ط© ط¬ط¯ظٹط¯ط©"))
    return json({ session: get(`SELECT * FROM agent_sessions WHERE id = ?`, sid) }, 201)
  }],

  ["DELETE", "/api/agent/sessions/:id", ({ user, params }) => {
    if (!user) return json({ error: "unauthorized" }, 401)
    const s = get<{ id: string; user_id: string }>(`SELECT * FROM agent_sessions WHERE id = ?`, params.get("id")!)
    if (!s) return json({ error: "notFound" }, 404)
    if (s.user_id !== user.id && !can(user, "admin")) return json({ error: "errorPermission" }, 403)
    run(`DELETE FROM agent_sessions WHERE id = ?`, s.id)
    logActivity(user.id, "agent.delete", s.id)
    return json({ ok: true })
  }],

  ["GET", "/api/agent/sessions/:id", ({ user, params }) => {
    if (!user) return json({ error: "unauthorized" }, 401)
    const s = get<{ id: string; user_id: string }>(`SELECT * FROM agent_sessions WHERE id = ?`, params.get("id")!)
    if (!s) return json({ error: "notFound" }, 404)
    if (s.user_id !== user.id && !can(user, "admin")) return json({ error: "errorPermission" }, 403)
    return json({ session: s, messages: agent.messages(s.id) })
  }],

  ["POST", "/api/agent/sessions/:id/messages", async ({ user, body, params }) => {
    if (!user) return json({ error: "unauthorized" }, 401)
    const s = get<{ id: string; user_id: string }>(`SELECT * FROM agent_sessions WHERE id = ?`, params.get("id")!)
    if (!s) return json({ error: "notFound" }, 404)
    if (s.user_id !== user.id) return json({ error: "errorPermission" }, 403)
    const prompt = String(body?.content ?? "").trim()
    if (!prompt) return json({ error: "errorRequired" }, 400)
    const result = await agent.runAgent(s.id, prompt)
    logActivity(user.id, "agent.message", s.id, { tokens: result.tokens })
    return json({ ...result, messages: agent.messages(s.id) })
  }],

  // ---------- ط§ظ„ط£ط¹ط¶ط§ط، (ظ„ظ„ظ…ط´ط±ظپظٹظ†) ----------
  ["GET", "/api/members", ({ user }) => {
    if (!user) return json({ error: "unauthorized" }, 401)
    if (!can(user, "admin")) return json({ error: "errorPermission" }, 403)
    return json({
      members: all(`SELECT id, email, name, role, plan, status, created_at, last_login_at, avatar_color FROM users ORDER BY created_at DESC`),
    })
  }],

  ["PATCH", "/api/members/:id", async ({ user, body, params }) => {
    if (!user) return json({ error: "unauthorized" }, 401)
    if (!can(user, "admin")) return json({ error: "errorPermission" }, 403)
    const target = get<{ id: string; email: string }>(`SELECT * FROM users WHERE id = ?`, params.get("id")!)
    if (!target) return json({ error: "notFound" }, 404)
    if (target.id === user.id && body?.role && body.role !== user.role)
      return json({ error: "errorPermission" }, 403)
    if (user.role !== "owner" && body?.role === "owner") return json({ error: "errorPermission" }, 403)
    if (body?.role && ["owner", "admin", "member"].includes(body.role))
      run(`UPDATE users SET role = ? WHERE id = ?`, body.role, target.id)
    if (body?.status && ["active", "suspended"].includes(body.status))
      run(`UPDATE users SET status = ? WHERE id = ?`, body.status, target.id)
    if (body?.plan && ["trial", "pro", "enterprise"].includes(body.plan)) {
      run(`UPDATE users SET plan = ? WHERE id = ?`, body.plan, target.id)
      run(
        `UPDATE subscriptions SET plan = ?, price = ?, renews_at = ? WHERE user_id = ? AND status = 'active'`,
        body.plan,
        body.plan === "pro" ? 4900 : body.plan === "enterprise" ? 19900 : 0,
        now() + 1000 * 60 * 60 * 24 * 30,
        target.id,
      )
    }
    if (body?.password && String(body.password).length >= 8) {
      const { hash, salt } = hashPassword(String(body.password))
      run(`UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?`, hash, salt, target.id)
      run(`DELETE FROM sessions WHERE user_id = ?`, target.id)
    }
    logActivity(user.id, "member.update", target.email, body ?? {})
    return json({ member: get(`SELECT id, email, name, role, plan, status FROM users WHERE id = ?`, target.id) })
  }],

  ["DELETE", "/api/members/:id", ({ user, params }) => {
    if (!user) return json({ error: "unauthorized" }, 401)
    if (!can(user, "owner")) return json({ error: "errorPermission" }, 403)
    const target = get<{ id: string; email: string }>(`SELECT * FROM users WHERE id = ?`, params.get("id")!)
    if (!target) return json({ error: "notFound" }, 404)
    if (target.id === user.id) return json({ error: "errorPermission" }, 403)
    run(`DELETE FROM users WHERE id = ?`, target.id)
    logActivity(user.id, "member.delete", target.email)
    return json({ ok: true })
  }],

  // ---------- ط§ظ„ط§ط´طھط±ط§ظƒ ----------
  ["GET", "/api/billing", ({ user, req }) => {
    if (!user) return json({ error: "unauthorized" }, 401)
    const sub = get(`SELECT * FROM subscriptions WHERE user_id = ? ORDER BY started_at DESC`, user.id)
    return json({
      subscription: sub,
      plans: [
        { id: "trial", price: 0, features: dict(localeOf(user, req)).free },
        { id: "pro", price: 4900, features: "10 ظ…ط´ط§ط±ظٹط¹ آ· 500 ط³ط§ط­ط© آ· ط£ظˆظ„ظˆظٹط©" },
        { id: "enterprise", price: 19900, features: "ط¨ظ„ط§ ط­ط¯ظˆط¯ آ· ظپط±ظٹظ‚ آ· SSO" },
      ],
      strings: dict(localeOf(user, req)),
    })
  }],

  ["POST", "/api/billing/upgrade", ({ user, body }) => {
    if (!user) return json({ error: "unauthorized" }, 401)
    const plan = String(body?.plan ?? "trial")
    if (!["trial", "pro", "enterprise"].includes(plan)) return json({ error: "notFound" }, 400)
    run(`UPDATE users SET plan = ? WHERE id = ?`, plan, user.id)
    run(
      `UPDATE subscriptions SET plan = ?, price = ?, renews_at = ? WHERE user_id = ? AND status = 'active'`,
      plan,
      plan === "pro" ? 4900 : plan === "enterprise" ? 19900 : 0,
      now() + 1000 * 60 * 60 * 24 * 30,
      user.id,
    )
    logActivity(user.id, "billing.upgrade", plan)
    return json({ plan })
  }],

  // ---------- ط§ظ„ط³ط¬ظ„ ظˆط§ظ„ط¥ط­طµط§ط¦ظٹط§طھ ----------
  ["GET", "/api/activity", ({ user }) => {
    if (!user) return json({ error: "unauthorized" }, 401)
    const scope = can(user, "admin") ? "" : `WHERE a.user_id = '${user.id}'`
    return json({
      activity: all(
        `SELECT a.*, u.name AS user_name, u.avatar_color
           FROM activity a LEFT JOIN users u ON u.id = a.user_id
           ${scope} ORDER BY a.created_at DESC LIMIT 200`,
      ),
    })
  }],

  ["GET", "/api/stats", ({ user }) => {
    if (!user) return json({ error: "unauthorized" }, 401)
    const visible = can(user, "admin")
    return json({
      users: visible ? all<{ c: number }>(`SELECT COUNT(*) c FROM users`)[0].c : 1,
      projects: get<{ c: number }>(`SELECT COUNT(*) c FROM projects`)!.c,
      sessions: get<{ c: number }>(`SELECT COUNT(*) c FROM agent_sessions`)!.c,
      tokens: agent.totalTokens(user.id),
      announcements: all(`SELECT * FROM announcements WHERE active = 1 ORDER BY created_at DESC LIMIT 5`),
      live: agent.modelAvailable(),
    })
  }],

  // ---------- ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ ظˆط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ ----------
  ["POST", "/api/announcements", async ({ user, body }) => {
    if (!user || !can(user, "admin")) return json({ error: "errorPermission" }, 403)
    const aId = id("ann")
    run(
      `INSERT INTO announcements (id, title, body, level, created_at) VALUES (?, ?, ?, ?, ?)`,
      aId,
      String(body?.title ?? ""),
      String(body?.body ?? ""),
      String(body?.level ?? "info"),
      now(),
    )
    logActivity(user.id, "announcement.create", aId)
    return json({ ok: true }, 201)
  }],

  ["GET", "/api/health", () =>
    json({ ok: true, service: "kanf", version: "0.1.0", time: new Date().toISOString() })],
]

export async function handleApi(url: URL, req: Request): Promise<Response | undefined> {
  const pathname = url.pathname
  if (!pathname.startsWith("/api/")) return undefined

  let body: unknown = undefined
  if (req.method === "POST" || req.method === "PATCH" || req.method === "PUT") {
    try {
      body = await req.json()
    } catch {
      body = undefined
    }
  }

  const user = currentUser(req)

  for (const [method, pattern, handler] of routes) {
    if (method !== req.method) continue
    const m = match(pattern, pathname)
    if (!m) continue
    return await handler({ user, body: body ?? {}, params: m, req })
  }

  return json({ error: "notFound" }, 404)
}

function match(pattern: string, pathname: string): URLSearchParams | null {
  const p = pattern.split("/")
  const s = pathname.split("/")
  if (p.length !== s.length) return null
  const params = new URLSearchParams()
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) params.set(p[i].slice(1), decodeURIComponent(s[i]))
    else if (p[i] !== s[i]) return null
  }
  return params
}
