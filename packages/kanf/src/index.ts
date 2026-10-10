import { handleApi } from "./api"
import { get, run, now, all } from "./db"
import { createUser, logActivity } from "./auth"
import { dict } from "./i18n"

const PORT = Number(process.env.KANF_PORT ?? 4040)

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
}

async function serveStatic(pathname: string): Promise<Response> {
  let rel = decodeURIComponent(pathname)
  if (rel === "/") rel = "/index.html"
  if (rel === "/app" || rel === "/dashboard") rel = "/app.html"
  // ظ…ظ†ط¹ ط§ظ„ط®ط±ظˆط¬ ظ…ظ† ظ…ط¬ظ„ط¯ public
  if (rel.includes("..")) return new Response("Bad request", { status: 400 })

  let target = new URL(`../public${rel}`, import.meta.url)
  let f = Bun.file(target)
  if (!(await f.exists())) {
    if (rel.startsWith("/assets/") || rel.startsWith("/vendor/")) return new Response("Not found", { status: 404 })
    // SPA fallback
    target = new URL("../public/index.html", import.meta.url)
    f = Bun.file(target)
    if (!(await f.exists())) return new Response("Not found", { status: 404 })
  }

  const ext = rel.slice(rel.lastIndexOf("."))
  return new Response(f, {
    headers: { "content-type": MIME[ext] ?? "application/octet-stream", "cache-control": "no-cache" },
  })
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    if (url.pathname.startsWith("/api/")) {
      const res = await handleApi(url, req)
      if (res) return res
    }

    return serveStatic(url.pathname)
  },
})

// ---- طھظ‡ظٹط¦ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ ط§ظ„ط£ظˆظ„ظٹط© ----
function bootstrap() {
  const users = get<{ c: number }>(`SELECT COUNT(*) c FROM users`)?.c ?? 0
  if (users === 0) {
    createUser({ email: "owner@kanf.dev", name: "ظ…ط§ظ„ظƒ ط§ظ„ظ…ظ†طµط©", password: "Kanf#2026", role: "owner", plan: "enterprise" })
    createUser({ email: "admin@kanf.dev", name: "ط§ظ„ظ…ط´ط±ظپ", password: "Kanf#2026", role: "admin", plan: "pro" })
    createUser({ email: "member@kanf.dev", name: "ط¹ط¶ظˆ ظپط±ظٹظ‚", password: "Kanf#2026", role: "member", plan: "trial" })

    const ownerId = get<{ id: string }>(`SELECT id FROM users WHERE email = 'owner@kanf.dev'`)!.id
    run(
      `INSERT INTO projects (id, owner_id, name, description, status, language, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', 'typescript', ?, ?)`,
      "prj_welcome",
      ownerId,
      "ظ…ط´ط±ظˆط¹ طھط±ط­ظٹط¨ظٹ",
      "ظ…ط´ط±ظˆط¹ طھط¬ط±ظٹط¨ظٹ ط¯ط§ط®ظ„ ظ…ظ†طµط© ظƒظ†ظپ â€” ط¹ط¯ظ‘ظ„ ط§ط³ظ…ظٹ ط£ظˆ ط§ط­ط°ظپظ‡ ظˆط§ط¨ط¯ط£ ظ…ظ† ط¬ط¯ظٹط¯.",
      now(),
      now(),
    )
    logActivity(ownerId, "system.seed", "kanf")

    const ar = dict("ar")
    run(
      `INSERT INTO announcements (id, title, body, level, created_at) VALUES (?, ?, ?, ?, ?)`,
      "ann_welcome",
      `ط£ظ‡ظ„ط§ظ‹ ط¨ظƒ ظپظٹ ${ar.brand}`,
      "ط§ط¶ط؛ط· ط¹ظ„ظ‰ آ«ط§ظ„ظˆظƒظٹظ„آ» ظ„ط¨ط¯ط، ط£ظˆظ„ ط­ظˆط§ط± ظ…ط¹ ط§ظ„ظˆظƒظٹظ„ ط§ظ„ط¨ط±ظ…ط¬ظٹ. ط£ط¶ظپ KANF_AI_API_KEY ظ„طھظپط¹ظٹظ„ ظ†ظ…ظˆط°ط¬ ط­ظ‚ظٹظ‚ظٹ.",
      "info",
      now(),
    )
  }

  const count = all(`SELECT id FROM projects`).length
  void count
}

bootstrap()

console.log(`
  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”گ
  â”‚   ظƒظ†ظپ آ· Kanf  â€”  ظ…ظ†طµط© ط§ظ„ظˆظƒظٹظ„ ط§ظ„ط¨ط±ظ…ط¬ظٹ    â”‚
  â”‚   http://localhost:${String(PORT).padEnd(5)}              â”‚
  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”ک
  طھط´ط؛ظٹظ„: bun run packages/kanf/src/index.ts
`)

export { server }
