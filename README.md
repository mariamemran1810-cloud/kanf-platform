<p align="center">
  <img src="packages/kanf/public/assets/logo.svg" alt="Kanf logo" width="128" />
</p>

<h1 align="center">Kanf · كنف</h1>

<p align="center">
  <b>Arabic-first AI coding agent platform</b><br/>
  Projects · AI agent workspaces · teams · billing — one dashboard.
</p>

<p align="center">
  <a href="https://mariamemran1810-cloud.github.io/kanf-platform/">🌐 Live site</a> ·
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
| AI agent | Three engines: the full **OpenCode** agent, an OpenAI-compatible API, or demo mode |
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

### Agent engines

The agent can answer through three engines, tried in order until one succeeds:

| Engine | When | What it is |
| --- | --- | --- |
| `opencode` | OpenCode sources are in this repo, or `opencode` is on `PATH` | A real coding agent with file and shell tools |
| `openai` | `KANF_AI_API_KEY` is set | Direct OpenAI-compatible API call |
| `demo` | always | Offline explanatory replies — the last resort |

```bash
KANF_ENGINE=opencode OPENCODE_API_KEY="..." bun run dev:kanf
```

Every reply carries an `engine` field (`opencode` · `openai` · `demo`) so clients know which one
actually answered. `KANF_ENGINE=auto` (the default) only tries OpenCode when it is configured,
so a fresh clone stays instant. All variables are documented in
[`packages/kanf/GUIDE.md`](packages/kanf/GUIDE.md).

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

## Branches

| Branch | Contents |
| --- | --- |
| `main` | The Kanf platform — default branch, what CI and Pages build. |
| `dev` | A byte-for-byte snapshot of upstream OpenCode (6509 files), kept for provenance. Its tree matches the original commit exactly; the commits on top of it are packaging steps. |

`dev` is a backup of the fork's source material, not an active line of development — work on `main`.

## Quality gates

```bash
bun run --cwd packages/kanf typecheck   # tsc  → 0 errors
bun run --cwd packages/kanf lint        # oxlint → 0 errors
```

Both run in CI on every push that touches `packages/kanf` — see [`.github/workflows/kanf-ci.yml`](.github/workflows/kanf-ci.yml).

## Deploying

The repository ships a ready [`Dockerfile`](Dockerfile) and [`render.yaml`](render.yaml), so the
platform deploys to Render in two clicks — there is no build step at all (zero runtime
dependencies):

**https://render.com/deploy?repo=https://github.com/mariamemran1810-cloud/kanf-platform**

Render assigns `PORT` and the server honours it; the health check is `/api/health`, and demo
accounts are seeded automatically on first boot. On the free plan the disk is ephemeral, so the
database resets on each redeploy — attach a disk when you upgrade.

See [`packages/kanf/GUIDE.md`](packages/kanf/GUIDE.md) for the full Arabic guide:
environment variables, roles, screens, REST API, security model, and hosting options.

The marketing site is published automatically by [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

## License

[MIT](LICENSE) — OpenCode portions remain under their original license.
