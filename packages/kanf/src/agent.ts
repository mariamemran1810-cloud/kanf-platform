import { get, all, id, now, run } from "./db"
import type { User } from "./auth"

const BASE = process.env.KANF_AI_BASE_URL ?? "https://api.openai.com/v1"
const KEY = process.env.KANF_AI_API_KEY ?? ""
const MODEL = process.env.KANF_AI_MODEL ?? "gpt-4o-mini"

export function modelAvailable() {
  return KEY.length > 0
}

export function defaultModel() {
  return MODEL
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

export function messages(sessionId: string) {
  return all(`SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC`, sessionId)
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
  const history = messages(sessionId)
    .slice(-20)
    .map((m) => ({ role: (m as { role: string }).role, content: (m as { content: string }).content }))

  addMessage(sessionId, "user", userPrompt, estimateTokens(userPrompt))

  if (!modelAvailable()) {
    const reply = demoReply(userPrompt)
    addMessage(sessionId, "assistant", reply, estimateTokens(reply))
    return { reply, tokens: estimateTokens(reply), live: false }
  }

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
        { role: "user", content: userPrompt },
      ],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    const reply = `تعذّر الوصول إلى النموذج (${res.status}).\n\n\`\`\`\n${detail.slice(0, 400)}\n\`\`\``
    addMessage(sessionId, "assistant", reply, 0)
    return { reply, tokens: 0, live: false, error: true }
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const reply = data.choices?.[0]?.message?.content ?? "(رد فارغ)"
  const tokens =
    (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0) || estimateTokens(reply)
  addMessage(sessionId, "assistant", reply, tokens)
  return { reply, tokens, live: true }
}

export function totalTokens(userId: string) {
  return (
    get<{ t: number }>(
      `SELECT COALESCE(SUM(tokens_in + tokens_out), 0) t FROM agent_sessions WHERE user_id = ?`,
      userId,
    )?.t ?? 0
  )
}
