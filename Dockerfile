# كنف — صفر اعتماديات وقت التشغيل، فلا حاجة إلى bun install
FROM oven/bun:1-alpine

WORKDIR /app

# ننسخ الباكدج وحده: لا node_modules، ولا قواعد بيانات محلية، ولا تاريخ المستودع
COPY packages/kanf ./packages/kanf

# قاعدة البيانات تُنشأ تلقائياً عند أول تشغيل (db.ts ينشئ المجلد)
ENV KANF_DB=/app/data/kanf.db
ENV NODE_ENV=production
RUN mkdir -p /app/data

# المنفذ يحدّده المستضيف عبر PORT (Render يضبطه تلقائياً)؛ محلياً يبقى 4040
EXPOSE 10000

CMD ["bun", "run", "packages/kanf/src/index.ts"]
