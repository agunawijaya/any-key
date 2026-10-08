# ADR 0003: Where the kit lives, and its contract

- **Status:** Accepted
- **Date:** 2026-10-07
- **Decided in:** prompt 00 (foundation retrofit)

## Context

Before the retrofit, each game had its own top bar, its own pause handling, its own results screen, its own storage
key and its own achievement list. They had drifted apart: four ways to leave a game, Esc doing different things,
achievements that existed only inside each game. Later prompts add more games, often several at once in parallel
sessions, so the shared parts need one home and a contract that rarely changes.

## Decision

**Location.** The kit is two folders:

- `lib/kit/`: logic with no React, so server components and scripts can import it. Storage (`save.ts`), migrations,
  the Keyring (`keyring.ts`, `achievements.ts`), stats, the progress bridge (`progress.ts`), RNG, daily numbering,
  appearance, sound, keys, share, colour, and the manifest type.
- `components/kit/`: React. `GameShell`, `PauseMenu`, `Results`, `Dialog`, `Story`, `Keycap`, `KeyringToasts`,
  `TodayStrip`, `SettingsPanel`, `BarTools`, `ForgetButton`, `icons.tsx`, and the hooks in `hooks.ts`.

**Contract.** A game connects to the collection through four things:

1. **Its manifest** (`lib/<id>/manifest.ts`, type `GameManifest`), listed in `lib/catalog.ts`. The Hall, the shell
   and the Keyring read nothing else about a game.
2. **The shell.** The game renders inside `GameShell`, reports rounds with `usePlayScreen` (screen, pause and resume,
   its pause items, whether leaving loses progress) and finishes rounds on `Results`. The shell owns the top bar,
   the hash routes, Esc, `?` and K, the pause menu order, the sheets and the Story tab.
3. **Storage.** The game keeps its progress in a `createStore` under `anykey.<id>.save`, with versions and
   migrations, usually through `createProgress`, which sends achievements, dailies and finished rounds to the
   Keyring and the stats.
4. **Keys.** A game claims a key by calling `preventDefault()`; the shell acts only on keys nobody claimed.

**Ownership.** One session per wave owns kit changes, named in that wave's prompts. Other sessions write helpers
inside their own game folder and list them as kit candidates.

## Consequences

- A new game gets the navigation standard, the Keyring, appearance, sound, storage and the Story without writing
  them, and a player's habits carry from one game to the next.
- The kit's public API is what `docs/ARCHITECTURE.md` describes. Changing it means changing every game that uses
  it, so kit changes are rare and owned.
- Games with special needs (Bop Box is all menu and has no rounds; Don't Crater holds its toasts until it lands)
  get them through options on the contract, not by going around it.
