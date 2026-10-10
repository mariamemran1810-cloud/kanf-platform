import { get, all, id, now, run } from "./db"
import type { User } from "./auth"
import {
  engineAvailable,
  engineConfigured,
  runOpencode,
  type EngineId,
  type History,
} from "./engine"

const BASE = process.env.KANF_AI_BASE_URL ?? "https://api.openai.com/v1"
const KEY = process.env.KANF_AI_API_KEY ?? ""
const MODEL = process.env.KANF_AI_MODEL ?? "gpt-4o-mini"

/** auto | opencode | openai | demo */
const MODE = (process.env.KANF_ENGINE ?? "auto").trim().toLowerCase()

export function modelAvailable() {
  return KEY.length > 0
}

export function defaultModel() {
  return MODEL
}

/**
 * سبب فشل محرك OpenCode في هذه الجلسة — نتذكّره حتى لا نعيد المحاولة البطيئة
 * مع كل رسالة. يُعاد ضبطه عند نجاح المحرك لاحقاً.
 */
let opencodeFailure: string | undefined

/** الترتيب الذي تُجرَّب فيه المحركات، من الأنسب إلى الاحتياطي */
function enginePlan(): EngineId[] {
  if (MODE === "opencode") return ["opencode"]
  if (MODE === "openai") return ["openai"]
  if (MODE === "demo") return ["demo"]

  const configured = Boolean(process.env.OPENCODE_API_KEY || process.env.KANF_ENGINE_MODEL)
  const canOpencode = engineAvailable() && (configured || engineConfigured()) && !opencodeFailure
  const canOpenai = modelAvailable()

  // إن كان مفتاح كنف مهيّأً نستخدمه أولاً (أسرع وأخف)، وإلا نبدأ بالمحرك الكامل
  const order: EngineId[] = configured || !canOpenai ? ["opencode", "openai"] : ["openai", "opencode"]
  const plan = order.filter((e) => (e === "opencode" ? canOpencode : canOpenai))
  // وضع العرض هو الملاذ الأخير دائماً في الوضع التلقائي
  return plan.length > 0 ? [...plan, "demo"] : ["demo"]
}

/** المحرك الذي ستُنفَّذ عليه الطلب التالي (للعرض في واجهة API) */
export function activeEngine(): EngineId {
  return enginePlan()[0] ?? "demo"
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createAgentSession(user: User, projectId?: string, title = "ساحة جديدة") {
  const sessionId = id("agt")
  run(
    `INSERT INTO agent_sessions (id, project_id, user_id, title, model, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    sessionId,
    projectId ?? null,
    user.id,
    title,
    MODEL,
    now(),
    now(),
  )
  return sessionId
}

export function agentSessions(userId: string) {
  return all(
    `SELECT s.*, p.name AS project_name
       FROM agent_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
      WHERE s.user_id = ?
      ORDER BY s.updated_at DESC`,
    userId,
  )
}

export function addMessage(sessionId: string, role: string, content: string, tokens = 0) {
  run(
    `INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`,
    id("msg"),
    sessionId,
    role,
    content,
    now(),
  )
  run(`UPDATE agent_sessions SET updated_at = ? WHERE id = ?`, now(), sessionId)
  if (role === "user") {
    run(`UPDATE agent_sessions SET tokens_in = tokens_in + ? WHERE id = ?`, tokens, sessionId)
  } else {
    run(`UPDATE agent_sessions SET tokens_out = tokens_out + ? WHERE id = ?`, tokens, sessionId)
  }
}

type MessageRow = { role: string; content: string }

export function messages(sessionId: string): MessageRow[] {
  return all<MessageRow>(
    `SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC`,
    sessionId,
  )
}

/** محدّد نوع: هل القيمة سجل حقاً؟ بديل آمن عن `as` */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/** تحويل قيمة مجهولة إلى سجل بأمان (بديل آمن عن `as`) */
function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4))
}

/** محاكاة ردّ الوكيل عندما لا يوجد مفتاح API حقيقي */
function demoReply(prompt: string): string {
  const snippet = prompt.trim().slice(0, 120)
  return [
    `**كنف (وضع العرض)** — استلمت طلبك:`,
    ``,
    `\`${snippet}${prompt.length > 120 ? "…" : ""}\``,
    ``,
    `لم يتم العثور على مفتاح API، لذا هذا ردّ توضيحي. لتفعيل النموذج الحقيقي شغّل الخادم مع:`,
    ``,
    "```bash",
    `KANF_AI_API_KEY=sk-... bun run packages/kanf/src/index.ts`,
    "```",
    ``,
    `**خطوات مقترحة لتنفيذ طلبك:**`,
    `1. تحديد الملفات المتأثرة`,
    `2. كتابة الاختبارات أولاً`,
    `3. تنفيذ التعديل والتحقق من البناء`,
  ].join("\n")
}

export async function runAgent(sessionId: string, userPrompt: string) {
  const history = messages(sessionId).slice(-20).map((m) => ({ role: m.role, content: m.content }))

  addMessage(sessionId, "user", userPrompt, estimateTokens(userPrompt))

  const failures: string[] = []

  for (const engine of enginePlan()) {
    try {
      const result = await dispatch(engine, userPrompt, history)
      addMessage(sessionId, "assistant", result.reply, result.tokens)
      return { reply: result.reply, tokens: result.tokens, live: engine !== "demo", engine }
    } catch (error) {
      const reason = messageOf(error)
      failures.push(`${engine}: ${reason}`)
      // لا نعيد المحاولة البطيئة لنفس المحرك في هذه الجلسة
      if (engine === "opencode") opencodeFailure = reason
    }
  }

  const reply = failureReply(failures)
  addMessage(sessionId, "assistant", reply, 0)
  return { reply, tokens: 0, live: false, engine: "demo" as const, error: true }
}

async function dispatch(
  engine: EngineId,
  prompt: string,
  history: History,
): Promise<{ reply: string; tokens: number }> {
  if (engine === "opencode") return await runOpencode(prompt, history)
  if (engine === "openai") return await runOpenAI(prompt, history)
  const reply = demoReply(prompt)
  return { reply, tokens: estimateTokens(reply) }
}

function failureReply(failures: string[]): string {
  if (failures.length === 0) return "لا يوجد محرك متاح للردّ حالياً."
  return [
    "**تعذّر الوصول إلى كل المحركات المهيّأة**",
    "",
    ...failures.map((f) => `- \`${f.slice(0, 300)}\``),
    "",
    "راجع مفاتيح المحركات في `packages/kanf/GUIDE.md`، أو أعد تشغيل الخادم بعد الإعداد.",
  ].join("\n")
}

async function runOpenAI(prompt: string, history: History): Promise<{ reply: string; tokens: number }> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "أنت الوكيل البرمجي داخل منصة كنف. أجب بالعربية الفصحى المبسطة ما لم يطلب المستخدم غير ذلك. استخدم Markdown وقسّم الإجابات إلى خطوات واضحة.",
        },
        ...history,
        { role: "user", content: prompt },
      ],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`تعذّر الوصول إلى النموذج (${res.status}) ${detail.slice(0, 240)}`)
  }

  // استجابة النموذج تصل من نظام خارجي: نتحقق من شكلها بدل افتراضه
  const data = asRecord(await res.json().catch(() => null))
  const choices = Array.isArray(data.choices) ? data.choices : []
  const message = asRecord(asRecord(choices[0]).message)
  const reply = asString(message.content)
  if (!reply) throw new Error("أعاد النموذج رداً فارغاً")

  const usage = asRecord(data.usage)
  const tokens = asNumber(usage.prompt_tokens) + asNumber(usage.completion_tokens) || estimateTokens(reply)
  return { reply, tokens }
}

export function totalTokens(userId: string) {
  return (
    get<{ t: number }>(
      `SELECT COALESCE(SUM(tokens_in + tokens_out), 0) t FROM agent_sessions WHERE user_id = ?`,
      userId,
    )?.t ?? 0
  )
}
