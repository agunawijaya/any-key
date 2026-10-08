# ADR 0002: Zero raster art, and the sound bank exception

- **Status:** Accepted
- **Date:** 2026-10-07
- **Decided in:** `CLAUDE.md` rule 3, recorded here by prompt 00

## Context

Any Key exists partly to show what can be drawn in code. Every card, planet, cartridge, keycap, board, terrain and
lander in the collection is drawn with SVG, Canvas 2D or CSS. A single PNG would make that claim untrue, and emoji
look different on every system, so neither belongs on the page.

The rule also covers the network: the games must work offline once loaded, and nothing a player does should send a
request to a third party.

## Decision

1. **No raster art.** No PNG, JPEG, WebP, GIF or similar image in the app. Everything a player sees is drawn in code.
   Icons are SVG (`components/kit/icons.tsx` and each game's own `icons.tsx`).
2. **No emoji as art or icons** on the page. Plain-text share cards may use emoji, because they are pasted into other
   apps that draw them; they are built in `lib/`, never in `components/` or `app/`.
3. **No runtime network requests.** Fonts come through `next/font`, which downloads them at build time and serves
   them from the app. No analytics, no CDNs, no remote APIs.
4. **Screenshots are documentation, not art.** `docs/media/` may hold JPEG screenshots and hero frames.
5. **Exceptions need an ADR approved by the owner.** There is one: Bop Box's sound bank.

### The sound bank exception

Bop Box plays real instruments, and no one can draw a violin's sound in code that would be worth hearing. It uses
`public/soundfont/bopbox.sf3`, a trimmed build of MuseScore General (MIT licence, built on FluidR3 and later work;
the licence ships next to it). `scripts/build-soundfont.mts` builds it from the full bank. The app serves it itself,
so loading it is not a request to anyone else. The owner approved it before this ADR was written; this ADR records
the approval.

## Consequences

- `npm run check:guardrails` (`scripts/guardrails.ts`) enforces points 1 to 4: it fails on raster files outside
  `docs/` and `public/soundfont/`, on emoji in `app/` or `components/`, and on http(s) URLs in shipped code
  (XML namespace names such as the SVG namespace are allowed).
- The emoji the games used before (flag emblems, mode icons, instrument icons) were replaced by SVG in prompt 00.
  Saved flags that used an emoji emblem migrate to the matching SVG emblem.
- Art takes longer to make, and every piece has to be designed for light and dark.
