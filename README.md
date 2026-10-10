<p align="center">
  <img src="packages/kanf/public/assets/logo.svg" alt="Kanf logo" width="128" />
</p>

<h1 align="center">Kanf · كنف</h1>

<p align="center">
  <b>Arabic-first AI coding agent platform</b><br/>
  Projects · AI agent workspaces · teams · billing — one dashboard.
</p>

<p align="center">
  <a href="README.ar.md">العربية</a> ·
  <a href="packages/kanf/GUIDE.md">User guide</a> ·
  <a href="packages/kanf/README.md">Developer docs</a>
</p>

---

> ⚠️ **Not affiliated with the OpenCode team.** This repository is a fork of
> [OpenCode](https://github.com/anomalyco/opencode) used as the foundation for the Kanf platform.
> The original documentation is preserved in [`README.upstream.md`](README.upstream.md) and
> [`README.ar.upstream.md`](README.ar.upstream.md).

---

## What is Kanf?

**Kanf (كنف)** is a complete SaaS platform built from scratch inside this repository.
It ships Arabic-first (RTL) and English interfaces, role-based access, an AI coding agent,
activity auditing, and subscription plans — all running on a zero-dependency core.

| Layer | Technology |
| --- | --- |
| Platform runtime | [Bun](https://bun.sh) `Bun.serve` — no web framework |
| Database | SQLite via `bun:sqlite` — no ORM |
| Auth | PBKDF2-SHA256 (200k iterations) + signed session cookies |
| AI agent | OpenAI-compatible API, demo mode without a key |
| Interfaces | Arabic (RTL) first, English second |

Zero runtime dependencies means `bun run dev:kanf` works immediately after cloning —
no build step, no bundler, no database server.

## Quick start

```bash
bun install                # once, for the whole monorepo
bun run dev:kanf           # starts Kanf on http://localhost:4040
```

Demo accounts (password `Kanf#2026`):

| Role | Email |
| --- | --- |
| Owner | `owner@kanf.dev` |
| Admin | `admin@kanf.dev` |
| Member | `member@kanf.dev` |

With no `KANF_AI_API_KEY` set, the agent runs in **demo mode** and explains how to enable a real model.

```bash
KANF_AI_API_KEY="sk-..." bun run dev:kanf   # real model
```

## Repository layout

```
packages/
  kanf/        ← the Kanf platform (server, dashboard, marketing site)
  opencode/    ← the OpenCode CLI (agent engine)
  console/     ← billing + marketing app (SolidStart + Stripe)
  web/         ← documentation site (Astro + Starlight)
  ...          ← 20+ packages (core, sdk, protocol, desktop, ...)
```

Everything except `packages/kanf` comes from upstream OpenCode and keeps its original behaviour.

## Quality gates

```bash
bun run --cwd packages/kanf typecheck   # tsc  → 0 errors
bun run --cwd packages/kanf lint        # oxlint → 0 errors
```

## Deploying

See [`packages/kanf/GUIDE.md`](packages/kanf/GUIDE.md) for the full Arabic guide:
environment variables, roles, screens, REST API, security model, and hosting options.

The marketing site is published automatically by [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

## License

[MIT](LICENSE) — OpenCode portions remain under their original license.
