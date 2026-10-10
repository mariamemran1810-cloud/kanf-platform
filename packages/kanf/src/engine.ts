import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

/**
 * محرك OpenCode — يشغّل وكيل OpenCode الكامل (أدوات حقيقية: قراءة الملفات والبحث
 * وتحريرها) كخلفية لمحادثات كنف، ثم يُسقط تلقائياً إلى المسار البديل عند الفشل.
 *
 * المتغيرات:
 *   KANF_ENGINE            auto | opencode | openai | demo   (الافتراضي: auto)
 *   KANF_ENGINE_MODEL      موديل صريح بصيغة provider/model
 *   KANF_ENGINE_DIR        مجلد عمل الوكيل (افتراضي: مجلد التشغيل)
 *   KANF_ENGINE_TIMEOUT_MS مهلة التنفيذ   (افتراضي: 120000)
 *   KANF_ENGINE_AUTO       "1" للسماح بتنفيذ أوامر وأرشفة الملفات بدون استيضاح
 *   KANF_OPENCODE_BIN      مسار صريح لتنفيذية opencode
 */

export type EngineId = "opencode" | "openai" | "demo"

const TIMEOUT = Number(process.env.KANF_ENGINE_TIMEOUT_MS ?? 120_000)
const AUTO_APPROVE = process.env.KANF_ENGINE_AUTO === "1"
/** حدود سطر الأوامر في ويندوز: نبقي الرسالة أصغر من ذلك بفارق مريح */
const MAX_MESSAGE = 24_000

/** متغيرات بيئة موروثة من جلسة OpenCode المضيفة تربك عملية مستقلة، فنُنظّفها */
function childEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (k === "OPENCODE_CLIENT" || k === "OPENCODE_SESSION_ID" || k === "OPENCODE_TERMINAL") continue
    env[k] = v
  }
  env.OPENCODE_DISABLE_EMBEDDED_WEB_UI = "1"
  env.OPENCODE_EXPERIMENTAL_FILEWATCHER = "0"
  return env
}

/** يحدد كيف يُشغَّل محرك OpenCode، أو `null` إذا لم يكن مثبتاً */
function engineCommand(): { bin: string; prefix: string[] } | null {
  const explicit = process.env.KANF_OPENCODE_BIN
  if (explicit && existsSync(explicit)) return { bin: explicit, prefix: [] }

  // 1) تنفيذية مثبتة على النظام
  const onPath = ["opencode.exe", "opencode"]
  for (const name of onPath) {
    const found = searchPath(name)
    if (found) return { bin: found, prefix: [] }
  }

  // 2) مصدر OpenCode داخل هذا المستودع (هذا هو الحال في المستودع الحالي)
  // import.meta.dir = <root>/packages/kanf/src
  const packages = resolve(import.meta.dir, "..", "..")
  const entry = join(packages, "opencode", "src", "index.ts")
  if (existsSync(entry) && process.execPath) {
    return {
      bin: process.execPath, // bun
      prefix: ["run", "--cwd", join(packages, "opencode"), "--conditions=browser", "src/index.ts"],
    }
  }
  return null
}

function searchPath(name: string): string | undefined {
  const raw = process.env.PATH ?? ""
  for (const dir of raw.split(process.platform === "win32" ? ";" : ":")) {
    if (!dir) continue
    try {
      const candidate = join(dir, name)
      if (existsSync(candidate)) return candidate
    } catch {
      continue
    }
  }
  return undefined
}

export function engineAvailable(): boolean {
  return engineCommand() !== null
}

/**
 * هل أُعدّ محرك OpenCode لاستقبال طلبات؟ لا نريد محاولة بطيئة (وقد تصل إلى
 * ثوانٍ) في كل مرة إذا لم يكن للمحرك مزوّد نموذج أصلاً.
 */
export function engineConfigured(): boolean {
  if (process.env.OPENCODE_API_KEY || process.env.KANF_ENGINE_MODEL) return true
  const home = process.env.USERPROFILE ?? process.env.HOME ?? ""
  if (!home) return false
  for (const file of ["opencode.jsonc", "opencode.json"]) {
    try {
      const raw = readFileSync(join(home, ".config", "opencode", file), "utf8")
      if (/"provider"\s*:\s*\{/.test(raw) && !/"provider"\s*:\s*\{\s*\}/.test(raw)) return true
    } catch {
      continue
    }
  }
  return false
}

function workspace(): string {
  const dir = process.env.KANF_ENGINE_DIR
  if (dir && existsSync(dir)) return resolve(dir)
  return process.cwd()
}

type Events = { texts: string[]; tokens: number; error?: string; session?: string }

/** يقرأ مخرجات `--format json` (JSONL) ويستخرج النص والرموز والأخطاء */
function collect(buffer: string): Events {
  const out: Events = { texts: [], tokens: 0 }
  for (const line of buffer.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed.startsWith("{")) continue
    let event: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(trimmed)
      event = asRecord(parsed)
    } catch {
      continue
    }
    const type = typeof event.type === "string" ? event.type : ""

    if (type === "text") {
      const part = asRecord(event.part)
      const text = typeof part.text === "string" ? part.text : ""
      if (text) out.texts.push(text)
    }

    if (type === "step_finish") {
      const part = asRecord(event.part)
      const usage = asRecord(part.tokens)
      out.tokens +=
        num(usage.input) + num(usage.output) + num(usage.cache && asRecord(usage.cache).read)
    }

    if (type === "error") {
      const error = asRecord(event.error)
      const data = asRecord(error.data)
      out.error = str(data.message) || str(error.name) || "unknown engine error"
    }

    if (typeof event.sessionID === "string") out.session = event.sessionID
  }
  return out
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

/** محدّد نوع: هل القيمة سجل حقاً؟ بديل آمن عن `as` */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
function str(value: unknown): string {
  return typeof value === "string" ? value : ""
}
function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

export type History = { role: string; content: string }[]

/** يبني الرسالة الواحدة التي تُمرَّر للوكيل (مع السياق السابق مختصراً) */
function buildMessage(prompt: string, history: History): string {
  const context = history
    .slice(-8)
    .map((m) => `${m.role === "user" ? "المستخدم" : "كنف"}: ${m.content.trim()}`)
    .join("\n")
  const full = context ? `=== السياق السابق ===\n${context}\n=== الطلب ===\n${prompt}` : prompt
  if (full.length <= MAX_MESSAGE) return full
  return full.slice(full.length - MAX_MESSAGE)
}

export async function runOpencode(prompt: string, history: History): Promise<{ reply: string; tokens: number }> {
  const engine = engineCommand()
  if (!engine) throw new Error("محرك OpenCode غير متوفر على هذا الخادم")

  const dir = workspace()
  const args = [...engine.prefix, "run", "--dir", dir, "--format", "json"]
  const model = process.env.KANF_ENGINE_MODEL
  if (model) args.push("-m", model)
  if (AUTO_APPROVE) args.push("--auto")
  args.push(buildMessage(prompt, history))

  return await new Promise<{ reply: string; tokens: number }>((resolvePromise, reject) => {
    const child = spawn(engine.bin, args, {
      cwd: dir,
      env: childEnv(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    })

    let stdout = ""
    let stderr = ""
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill("SIGKILL")
      reject(new Error(`انتهت مهلة محرك OpenCode بعد ${TIMEOUT} مللي ثانية`))
    }, TIMEOUT)

    const done = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }

    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()))
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()))

    child.on("error", (err) => done(() => reject(new Error(`تعذّر تشغيل المحرك: ${err.message}`))))

    child.on("close", (code) => {
      // ملاحظة: هذا المنفذ خارج نطاق وعد الرسالة، لذا نرفض صراحةً بدل `throw`
      done(() => {
        const events = collect(stdout)
        if (events.error) return reject(new Error(events.error))
        const reply = events.texts.join("\n").trim()
        if (code !== 0 || !reply) {
          const detail = (stderr.trim() || `رمز الخروج ${code}`).slice(-400)
          return reject(new Error(`فشل محرك OpenCode: ${detail}`))
        }
        resolvePromise({ reply, tokens: events.tokens || Math.max(1, Math.ceil(reply.length / 4)) })
      })
    })
  })
}
