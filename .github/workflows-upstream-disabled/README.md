# مشغّلات OpenCode المعطّلة

هذه الملفات ورثها المستودع عن [OpenCode](https://github.com/anomalyco/opencode).
نُقلت إلى هنا (وليس `.github/workflows/`) لأن GitHub يُشغّل كل ما يوجد في
`.github/workflows/` تلقائياً — وهو سلوك **غير مرغوب** في مستودع منتج مستقل.

## لماذا عُطّلت؟

| المجموعة | الخطر |
| --- | --- |
| `close-issues.yml`, `close-prs.yml`, `duplicate-issues.yml` | تُغلق قضايا وطلبات الدمج **تلقائياً** بعد مدة قصيرة |
| `compliance-close.yml` | تعمل كل **٣٠ دقيقة** على مدار الساعة (هدر دقائق Actions) |
| `publish*.yml`, `release*.yml`, `beta.yml` | تنشر إصدارات باسم OpenCode وتتطلب أسراراً غير موجودة هنا |
| `notify-discord.yml` | ترسل إشعارات إلى قناة Discord تخص فريق OpenCode |
| `test.yml`, `typecheck.yml`, `nix-*.yml` | تفشل دائماً لأن بناء وحدات tree-sitter يتطلب Python + MSVC |
| `review.yml`, `triage.yml`, `stats.yml`, `pr-*.yml` | أدوات إدارة مجتمع OpenCode — لا تخص كنف |

## ما يبقى مُفعّلاً

- **`pages.yml`** — ينشر الموقع التعريفي لمنصة كنف على GitHub Pages مع كل دفع.

## لإعادة تفعيل أي منها

انقل الملف عائداً إلى `.github/workflows/`:

```bash
git mv .github/workflows-upstream-disabled/close-issues.yml .github/workflows/
```

ثم تأكد من إضافة الأسرار المطلوبة في
**Settings → Secrets and variables → Actions**.
