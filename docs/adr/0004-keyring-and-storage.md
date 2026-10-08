# ADR 0004: The Keyring and versioned storage

- **Status:** Accepted
- **Date:** 2026-10-07
- **Decided in:** prompt 00 (foundation retrofit)

## Context

Each game saved its progress under its own key (`anykey.bopbox.v1`, `anykey.stickler.v1`, `anykey.outta.v1`,
`anykey.dontcrater.v1`) in its own shape, with no version inside the data. Achievements and finished dailies lived
inside those saves, so nothing outside a game could show them, and there was no safe way to change a save's shape.
Players already have these saves, and losing them is not acceptable.

## Decision

1. **One envelope.** Every save is `{ version, data }` under `anykey.<id>.save`, written and read only through
   `createStore` in `lib/kit/save.ts`. Each store lists its migrations; a store that reads an older version migrates
   it once, writes it back and carries on.
2. **Legacy saves are imported, never deleted.** On first read, a store with no save of its own reads the game's
   old key as version 1 and migrates it. The old key stays where it is, so going back to an older build loses
   nothing. "Forget my data" removes both.
3. **The Keyring is the single source of truth** for achievements and dailies across the collection
   (`anykey.keyring.save`: unlocked keycaps with their times, finished dailies by date, the level the player has
   seen, dismissed hints). On first use it imports the achievements and dailies from all four legacy saves.
4. **Games keep their own progress shape.** `createProgress` stores a game's progress without its achievement list,
   merges the Keyring's list back in when the game reads it, and turns new ids and dates into Keyring updates.
5. **Everything stays in the browser.** No accounts, no server, no sync. If storage fails, the stores keep working in
   memory for the session.
6. **Forgetting is per game or total,** always behind a confirmation, and keeps preferences (theme, Hall style,
   sound, motion), which are settings rather than data.

## Consequences

- The Keyring page, the toasts, the Today strip and the streak work the same way for every game, future ones
  included.
- XP and levels are worked out from the Keyring and the manifests (tier XP, daily XP), never stored, so changing the
  XP table changes everyone's level at once. Only `levelSeen` is stored, so the level-up ceremony plays once.
- A save's shape can change safely: add a version, write a migration, add a fixture to
  `tests/unit/migration.test.ts`.
- Players who had legacy data now have two saves. That is the price of never destroying one.
