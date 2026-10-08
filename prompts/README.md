# Prompts

Prompts for Claude Code sessions that work on Any Key. Each prompt names its own files, the shared files it must
leave alone, who owns the kit, and which dev-server port to use. Every session reads `CLAUDE.md` and
`.claude/skills/retro-reborn-builder/SKILL.md` first.

## Run order

| # | Prompt | What it does | Runs | Owner checkpoint | Status |
|---|---|---|---|---|---|
| 01 | [01-stickler-handfuls.md](01-stickler-handfuls.md) | Stickler: Handfuls mode | Wave 1 (2026-09-30) | None | Done (commit c2aa7f3) |
| 02 | [02-dont-crater-free-flight.md](02-dont-crater-free-flight.md) | Don't Crater: Free Flight | Wave 1 (2026-09-30) | Physics prototype + hero frames | Done (commit ed44764) |
| 00 | [00-retrofit.md](00-retrofit.md) | Foundation retrofit: kit, game contract, navigation standard, Keyring, docs set, Playwright, guardrails | **Alone** | After Stage 3 (shell + Keyring hero frames) | Done (approved at Stage 3; awaiting the owner's commit) |
| 03 | [03-two-humps.md](03-two-humps.md) | Two Humps (new game, from `desert.bas`): three pursuers, the camel that keeps running, Expedition, Daily, 1982 mode | After 00 is committed | Hero frames | Ready |

Polish prompts for the four existing games follow after 00, based on the architect's visual review.

## How to run a prompt

1. Commit the current state first (the owner commits; sessions never do).
2. Open a new Claude Code session in `E:\Projects\BASIC Programs\Porting\web`.
3. Paste: `Read prompts/00-retrofit.md and carry it out.`
4. The dev server runs at http://localhost:3210. Playwright uses its own port, 3211.
5. When the session stops at its checkpoint, send the hero frames to the architect chat for review.
