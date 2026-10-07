# CLAUDE.md — Any Key

Any Key is a public collection of classic BASIC programs from the 1970s and early 1980s (Creative Computing,
IBM PC, TRS-80, user-group disks), reborn as modern web games for players born decades after them. Each program
is redesigned, not emulated: we keep its soul and its quirks, and give it new looks, new controls and new ideas.

@AGENTS.md

## Before any work

Read `.claude/skills/retro-reborn-builder/SKILL.md` and follow it. Tasks arrive as prompts in `prompts/` (see
`prompts/README.md`). In your first message, summarise the hard rules below in five lines, name the prompt you
are running, who owns kit changes this wave, and your dev-server port.

This repo is a Next.js app, not the `packages/kit` + `games/<id>` monorepo the builder skill describes. Where the
skill says `games/<id>/…`, use the folder map in `docs/ARCHITECTURE.md` (§Folder map); where it says
`packages/kit`, use `lib/kit/` and `components/kit/`. Everything else in the skill applies as written.

## Hard rules

1. **Provenance.** The originals live outside the repo at `E:\Projects\BASIC Programs\Porting\src` and are
   read-only. Never copy their text, messages, data tables or level layouts into the repo; describe behaviour in
   our own words and write every line of UI copy fresh. Facts about an original come from its source code.
2. **Our own titles.** Game titles are ours. Trademarks never appear in titles or UI; the original is named only
   in the "inspired by" line (`original.title`, `original.file`) and in the docs.
3. **Visual asset policy: zero raster.** All art is drawn in code (SVG, Canvas 2D, WebGL/three.js, CSS) — this
   collection exists to show what Opus 5.5 can draw. No PNG/JPG/WebP art, no emoji as art or icons (use SVG
   icons). Exceptions need an ADR approved by the owner; the Bop Box sound bank is an existing approved audio
   exception. Fonts self-hosted (OFL/Apache). No runtime network requests.
4. **Web first.** Desktop, keyboard + mouse, 1280×720 to 2560×1440; small screens and touch must not break.
   Accessible: full keyboard play, visible focus for keyboard users only (`:focus-visible`), reduced motion
   honoured, AA contrast.
5. **Light and dark everywhere,** both designed (not one inverted), switching live.
6. **Navigation standard** (`docs/NAVIGATION.md`): "← Back to the Hall" on every game menu, a visible pause
   button with an Esc hint during play, the fixed pause and results order, browser Back works.
7. **Humanized code.** Intention-revealing names, small focused functions, comments that explain why, no filler,
   no AI-sounding comments, no commented-out code. TypeScript strict, ESLint clean.
8. **Docs per game** in `docs/<id>/`: ABOUT, HOW-TO-PLAY, ARCHITECTURE, ORIGINAL-ARCHITECTURE,
   CHANGES-FROM-ORIGINAL, NOTES. Markdown only, diagrams in Mermaid only.
9. **All ages, no gambling.** No real-money or loot-box mechanics, no purchases; scores are scores.
10. **Stay in your lane.** Touch only the folders your prompt names; shared files (`lib/catalog.ts`, README,
    `docs/PROGRESS.md`) only at the very end, re-reading them first and changing only your own entries.
11. **No commits, no pushes.** The owner commits.
