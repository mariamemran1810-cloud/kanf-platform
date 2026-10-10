# كنف — Kanf

<p align="center">
  <img src="public/assets/logo.svg" alt="شعار كنف" width="120" />
</p>

<p align="center">
  <strong>منصة SaaS عربية أولاً للوكيل البرمجي الذكي</strong><br/>
  Arabic-first SaaS platform for an AI coding agent
</p>

---

## ما هي كنف؟

**كنف** منصة برمجية حقيقية تجمع بين:

- **لوحة تحكم** للمستخدمين والمشاريع والجلسات
- **نظام حسابات كامل** — تسجيل، دخول، جلسات آمنة، أدوار (مالك / مشرف / عضو)
- **سجل نشاط** لكل ما يحدث داخل المنصة
- **إدارة اشتراكات وخطط** (تجريبي / احترافي / مؤسسي)
- **وحدة الوكيل الذكي** — ربط برامج نماذج الذكاء الاصطناعي (OpenAI-compatible)
- **واجهة عربية RTL أولاً** مع تبديل فوري إلى الإنجليزية

## التشغيل

```bash
# من جذر المستودع
bun install
bun run --cwd packages/kanf dev

# أو مباشرة
cd packages/kanf
bun run dev
```

ثم افتح: <http://localhost:4040>

## بيانات الدخول التجريبية

بعد تشغيل `bun run seed`:

| الدور | البريد | كلمة المرور |
| --- | --- | --- |
| مالك | `owner@kanf.dev` | `Kanf#2026` |
| مشرف | `admin@kanf.dev` | `Kanf#2026` |
| عضو | `member@kanf.dev` | `Kanf#2026` |

## البنية

```
packages/kanf/
├── src/
│   ├── index.ts     نقطة تشغيل الخادم (Bun.serve — بدون اعتماديات خارجية)
│   ├── db.ts        طبقة قاعدة البيانات (bun:sqlite)
│   ├── auth.ts      المصادقة والجلسات وتشفير كلمات المرور
│   ├── api.ts       واجهة REST للموارد
│   ├── agent.ts     محرك الوكيل الذكي
│   ├── i18n.ts      التدويل (عربي / إنجليزي)
│   └── seed.ts      بيانات تجريبية
├── public/          الواجهة (HTML/CSS/JS) — RTL أولاً
└── README.md
```

## المتغيرات البيئية

| المتغير | الوصف | الافتراضي |
| --- | --- | --- |
| `KANF_PORT` | منفذ الخادم | `4040` |
| `KANF_DB` | مسار قاعدة البيانات | `kanf.db` |
| `KANF_SECRET` | مفتاح توقيع الجلسات | يُولَّد ويُحفظ في `kanf.db` |
| `KANF_AI_BASE_URL` | عنوان واجهة الذكاء الاصطناعي | `https://api.openai.com/v1` |
| `KANF_AI_API_KEY` | مفتاح API للنموذج | — |
| `KANF_AI_MODEL` | اسم النموذج | `gpt-4o-mini` |

## الترخيص

MIT — مبني على [OpenCode](https://github.com/anomalyco/opencode) (رخصة MIT).
هذا المشروع **ليس** من إنتاج فريق OpenCode ولا تربطهم به أي صفة رسمية.
