# ADR 0001: Keep Next.js

- **Status:** Accepted
- **Date:** 2026-10-07
- **Decided in:** prompt 00 (foundation retrofit)

## Context

The builder skill (`.claude/skills/retro-reborn-builder/SKILL.md`) describes a monorepo: a `packages/kit` package and
one `games/<id>` package per game. Any Key was already a working Next.js app when the skill was written, with four
games, the Hall, build-time docs and a shared visual language, all on the App Router with CSS Modules.

Moving to the skill's layout would mean a new build setup, new routing, new font and docs loading, and moving every
file of four finished games, for no change a player would see.

## Decision

Keep the Next.js app (Next.js 16, React 19, App Router, CSS Modules, TypeScript strict). Map the skill's folders onto
the app instead of moving the app onto the skill:

| The skill says | Any Key uses |
|---|---|
| `packages/kit` | `lib/kit/` (logic, no React) and `components/kit/` (React) |
| `games/<id>/src` | `lib/<id>/` (engine) and `components/<id>/` (screens) |
| `games/<id>/docs` | `docs/<id>/` |
| a game's entry | `app/<id>/page.tsx` |

`docs/ARCHITECTURE.md` keeps the folder map, one row per game. The four existing games keep their folder names;
new games use one id everywhere.

## Consequences

- One build, one deploy, one set of dependencies. Every page is static.
- Docs are read at build time by a server component (`lib/docs.ts`), which a client-only setup couldn't do.
- `next dev` allows one dev server per folder, so the Playwright suites run against `next build` and
  `next start -p 3211` rather than a second dev server.
- This Next.js differs from older versions (`AGENTS.md`); anyone changing app code reads the bundled guide in
  `node_modules/next/dist/docs/` first.
- Games can't be versioned or published separately. Nothing needs that today.
