<p align="center">
  <img src="packages/kanf/public/assets/logo.svg" alt="شعار كنف" width="128" />
</p>

<h1 align="center">كنف · Kanf</h1>

<p align="center"><strong>منصة SaaS عربية أولاً للوكيل البرمجي الذكي</strong></p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="packages/kanf/README.md">توثيق المنصة</a> ·
  <a href="#-البداية-السريعة">البداية السريعة</a>
</p>

---

## 🧭 نبذة

**كنف** منصة برمجية حقيقية مبنية داخل مستودع OpenCode المفتوح المصدر (رخصة MIT)، وتجمع في مكان واحد:

- **🖥️ خادم المنصة** — `packages/kanf`، مبني على Bun + SQLite، **بلا أي اعتماديات خارجية**
- **🔐 حسابات وصلاحيات** — تسجيل ودخول آمن، جلسات موقّعة، ثلاثة أدوار: مالك · مشرف · عضو
- **🤖 الوكيل البرمجي** — ساحات حوار متعددة، سياق محفوظ، عدّاد رموز، وربط أي نموذج متوافق مع OpenAI
- **📊 لوحة تحكم** — إحصائيات، مشاريع، أعضاء، سجل نشاط، اشتراكات، إعدادات
- **🌍 عربية أولاً** — واجهة RTL أصلية، تبديل فوري إلى الإنجليزية، ووضع ليلي
- **💳 خطط اشتراك** — تجريبي / احترافي / مؤسسي، جاهزة للربط ببوابة دفع

> ⚠️ **تنويه:** هذا المشروع مستوحى من [OpenCode](https://github.com/anomalyco/opencode) برخصة MIT، وهو **ليس من إنتاج فريق OpenCode** ولا تربطهم به أي صفة رسمية.

---

## 🚀 البداية السريعة

```bash
# 1) تثبيت التبعيات
bun install

# 2) تشغيل المنصة
bun run --cwd packages/kanf dev
```

ثم افتح: **http://localhost:4040**

### حسابات تجريبية

| الدور | البريد الإلكتروني | كلمة المرور |
| --- | --- | --- |
| 👑 مالك | `owner@kanf.dev` | `Kanf#2026` |
| 🛡 مشرف | `admin@kanf.dev` | `Kanf#2026` |
| 👤 عضو | `member@kanf.dev` | `Kanf#2026` |

### تفعيل نموذج ذكاء حقيقي

```bash
KANF_AI_API_KEY=sk-... bun run packages/kanf/src/index.ts
```

بدون مفتاح، يعمل الوكيل في **وضع العرض** ويوضّح لك خطوات التفعيل.

---

## 🗂️ بنية المشروع

```
packages/kanf/
├── src/
│   ├── index.ts     نقطة التشغيل (Bun.serve)
│   ├── db.ts        قاعدة البيانات (bun:sqlite)
│   ├── auth.ts      المصادقة والجلسات
│   ├── api.ts       واجهة REST
│   ├── agent.ts     محرك الوكيل
│   ├── i18n.ts      التدويل (عربي/إنجليزي)
│   └── seed.ts      بيانات تجريبية
├── public/          الواجهة (HTML/CSS/JS)
└── README.md        توثيق مفصّل
```

---

## ☁️ النشر

| الهدف | الطريقة |
| --- | --- |
| **GitHub Pages** (الموقع التعريفي) | مجلد `docs/` + workflow تلقائي |
| **خادم خاص (VPS)** | `bun run --cwd packages/kanf start` خلف Caddy/Nginx |
| **Railway / Fly.io / Render** | أمر البداية: `bun run --cwd packages/kanf start` |

متغيرات بيئة الإنتاج: `KANF_SECRET` (توقيع الجلسات)، `KANF_AI_API_KEY` (النموذج)، `KANF_PORT` (المنفذ).

---

## 📄 الترخيص

[MIT](LICENSE) — مستوحى من [OpenCode](https://github.com/anomalyco/opencode).
