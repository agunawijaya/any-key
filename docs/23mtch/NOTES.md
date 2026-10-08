# Stickler: notes

The lab book for Stickler and *23 Matches*: facts we checked, the quirks we found, the simulations behind the balance, the tests that keep them true, and what is still open. The detail behind most facts is in [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

## Verified facts about the original

Line numbers refer to `23mtch.bas`, the read-only original outside the repo. "Decoded" means we followed the file's line links and decoded its tokens with a throwaway script outside the repo (last done on 7 October 2026).

1. **Size and format.** 46 lines and 1,164 bytes. Byte 0 is `FF` (an unprotected tokenized GW-BASIC program); the program ends with a `00 00` link followed by a `1A` byte. Verified: decoded, and checked against a hex dump.
2. **The first line sits at &H126E.** All 46 links agree with that base, which PC-BASIC's memory model gives for GW-BASIC's defaults. Verified: decoded the links (see [the file format](ORIGINAL-ARCHITECTURE.md#the-tokenized-file-format)).
3. **Lines 5 and 10 are credits**, and line 5 misspells Albrecht's name as "ALBRECHR". Line 5 stores two spaces before `REM`, line 10 one, line 100 none. Verified: decoded and hex dump. That the printed book lacks these lines and the DEC tape has the same typo comes from the research in [ABOUT.md](ABOUT.md), not re-checked this time.
4. **Four numeric variables** (`M`, `H`, `R`, `C`), no strings, arrays or subroutines, one statement per line. Verified: decoded.
5. **The pile starts at 23** (line 150), and both end-of-game branches jump back to line 140 (lines 430 and 460), so the rules print once per `RUN`. Verified: decoded.
6. **The four input checks** are at lines 240 (more than the pile), 250 (not whole), 260 (zero or less) and 270 (four or more), each jumping to 510; line 520 jumps back to 215. Verified: decoded.
7. **The computer concedes at line 305** when one match is left after your move, jumping to the human's win at 440 without taking it. Verified: decoded.
8. **The computer's formula.** Line 310 takes the remainder by 4 with the `INT` idiom; line 320 jumps to 350 unless the remainder is 1; line 350 takes (R + 3) mod 4; line 330 takes INT(3 × RND(0)) + 1. `RND` appears once in the program and `RANDOMIZE` never does. Verified: decoded.
9. **Line 370 can never be true**, and `END` at line 999 can never be reached: every path ends in a `GOTO` (lines 390, 430, 460, 520). Verified: decoded, plus the proof in [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md).
10. **On a PC, `RND(0)` is always .3116351**, so the losing computer always takes 1. Verified when [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md#what-rnd0-really-does) was written, by reading GW-BASIC's 1983 source (`MATH2.ASM`, `GWDATA.ASM`, `BIMISC.ASM`) and PC-BASIC's `randomiser.py`; the arithmetic, 5,228,370 ÷ 2²⁴ = 0.3116351, rechecked. Not run in an emulator.
11. **Against the PC version a perfect game always runs the same way:** you take 2, then 3 five times; the computer takes 1 each time and concedes at 1. Verified: simulated with `move1981` from `lib/stickler/sparky.ts`, which the check script confirms against the formula from every count from 1 to 23.
12. **The losing counts are 1, 5, 9, 13, 17 and 21**, so the first player wins from 23 by taking 2. Verified: the check script's brute force agrees with the closed formula for every pile up to 30 with take limits 3, 4 and 5.

## Quirks and bugs

| Quirk | Why (lines) | In Stickler |
|---|---|---|
| The "random" losing move is always 1 on a PC | `RND(0)` repeats GW-BASIC's fixed seed and nothing advances it (330) | Kept in 1981 mode only. Sparky's losing moves elsewhere are really random |
| The computer never takes the last match | It concedes as soon as it is left one (305) | Kept in 1981 mode. Elsewhere Sparky has to take it, and it burns |
| A win test that can never be true | The formula always leaves at least one match (370); the `REM` at 400 still lists it | Nothing to keep. The check script proves `move1981` never empties the pile |
| The count is always plural | The count line has one fixed wording (210) | Left out. The board says "1 stick left"; the terminal's count line avoids a plural |
| No way to quit, no score | Every path ends in a `GOTO`; `END` (999) is unreachable | Left out. Rounds end in a results card; the pause menu and Game menu lead out |
| "Cheating" has no cost and doesn't repeat the count | The cheat branch returns to the prompt at 215, not to the count at 210 (520) | Kept in 1981 mode. Elsewhere a refused pick costs nothing either, and the count stays on screen |
| An empty answer counts as cheating | BASIC's `INPUT` reads an empty answer as 0, which line 260 refuses | Kept in 1981 mode |

## Simulations

### The check script

Command, from the repo root:

```text
npm run check:stickler
```

It runs `tsx scripts/check-stickler.ts`. The run on 7 October 2026 took 14 seconds and printed "all Stickler checks passed". Its numbers:

| What it checks | Runs | Result |
|---|---|---|
| Closed-form solver against brute force, one row up to 30 sticks (limits 3, 4, 5) and nine multi-row positions | 99 positions | All agree |
| Ladder: each table winnable from the start, and perfect play against the table's own Sparky | 200 seeds × 10 tables | 2,000 of 2,000 won |
| Classic: perfect play against Rookie, Clever and Master | 300 seeds × 3 levels | 900 of 900 won |
| Master never turns a won position into a lost one, one row of 10 to 39 sticks, limits 3 to 5, he opens | 500 games | No blunders |
| Every Daily of 2026 is winnable | 365 days | All winnable |
| The 1981 formula from 1 to 23 sticks | 23 counts | Concedes at 1; otherwise takes 1–3, never empties the pile, leaves 1 more than a multiple of 4 whenever it can |
| Handfuls zone formula against an independent brute force, floor 1–4, limit up to 7, piles 1–60 | 1,320 positions | All agree, and so does the generic move search |
| Handfuls presets, you open: perfect play against Master | 200 seeds each | 200 of 200 on every preset; Sparky swept 1–2 (2–3), 2 (2–4), 1–3 (3–4), 2–3 (3–5), 2–4 (4–6) |
| Handfuls presets, Sparky opens: perfect play against Master | 200 seeds each | 200 of 200 on every preset; Sparky swept the full floor every time: 2, 2, 3, 3, 4 |
| Handfuls presets against Rookie and Clever, both openers | 100 seeds each | All won |
| Surprise piles: in range and winnable for you | 1,000 seeds × 5 presets × 2 openers | 10,000 of 10,000 |
| Every table the Game menu can deal against Sparky is winnable for you: Classic, 10 Ladder tables, 730 Dailies (2026 and 2027), every Handfuls setup | 2,751 tables | All winnable |
| Master in Handfuls never blunders, and from a pile he can finish he leaves exactly the floor | 1,000 random games | No blunders in 4,056 of his turns |
| Old tables keep a floor of 1 and their old descriptions (Classic, Ladder, the first four Versus presets, the Daily of 30 September 2026) | 16 tables | Unchanged |

The sweep sizes show why Sparky-starts tables end in the biggest sweep: they deal a count on the top of a zone, and the perfect player in the script always takes the smallest winning handful, which answers every take with (*a* + *b*) minus it and keeps Sparky on the top. When you open, each preset pile has a single winning first move, and it lands on the bottom of its zone (21 of 21–22 for 2–3); the player climbs only when Sparky's takes allow it, so the final sweep varies.

### Scratch measurements

These came from a throwaway script outside the repo that imports `lib/stickler`; a few lines over `dailyPuzzle` and `sparkyMove` reproduce them.

- **The Daily's range.** Over the 730 days of 2026 and 2027 the pile runs from **17 to 42** (the generator draws 17 to 41 and then raises a losing count by one), and the take limit is 3 on 268 days, 4 on 225 and 5 on 237. Daily #1 (1 January 2026) is 31 sticks, take 1–3; #280 (7 October 2026) is 22 sticks, take 1–3.
- **How strong each level feels.** A player who takes a random legal amount in Classic loses to Rookie 1,633 times in 2,000, to Clever 1,841 times and to Master 1,999 times.
- **Handfuls zones and surprise piles.** The first winning move from each preset pile is 2 (2–3 and 2–4), 3 (3–4 and 3–5) and 4 (4–6). When you open, the surprise pile draws from 10 fair counts for 2–3 (15 to 30), 13 for 2–4 (18 to 36) and 3–4 (21 to 42), 16 for 3–5 (24 to 48) and 19 for 4–6 (30 to 60).

## Regression checks

| Check | What it locks | Tolerance |
|---|---|---|
| `scripts/check-stickler.ts` | Every number in the table above: winnable tables, perfect-play wins, the zones for 2–3 ("1-2 6-7 11-12 16-17 21-22"), the preset descriptions, old descriptions and floors | Exact: any miss prints `FAIL`. The script does not yet set a failing exit code, so read its last line |
| `tests/unit/dailies.test.ts` | The Daily for 7 October 2026: #280, key 2026-10-07, one row of 22, take 1–3, you open, Master | Exact equality |
| `tests/unit/daily.test.ts` | Daily numbering: #1 on 2026-01-01, #280 on 2026-10-07 at any hour, the old formula on every day of two years | Exact |
| `tests/unit/rng.test.ts` | `mulberry32(12345)`'s first four outputs, so no seeded table moves | Exact |
| `tests/unit/migration.test.ts` | A v1 save keeps 7 keycaps, all Ladder stars, both dailies, the share text, the Handfuls record and setup; stats seeded to 17 plays, 12 wins, streak 2, best 4; the legacy key untouched; the new save at version 2 without achievements | Exact |
| `tests/unit/manifest.test.ts` | Every achievement title and hint as it was before the kit, unique ids, known tiers | Exact |
| `tests/e2e/navigation.spec.ts`, `keyring.spec.ts`, `story.spec.ts` | Pause and results order, Back asking first, Rule Bender from pressing `4`, every Story chapter and diagram rendering | Pass or fail |

## Open questions

- **The losing move on Ahl's RSTS/E system.** BASIC-PLUS ignores `RND`'s argument, so the take varied, but the actual sequence is unverified. Running the DEC text in a PDP-11 emulator with RSTS/E and BASIC-PLUS would settle it.
- **IBM BASICA's `RND(0)`.** Unverified. Running the file in PCjs's BASICA would settle it, and would tell us whether a "BASICA" variant of 1981 mode would differ.
- **Exponent input.** We believe GW-BASIC's `INPUT` reads `1E0` as 1 while the 1981 terminal answers `?Redo from start`. Trying it in PC-BASIC would settle it.
- **Who tokenized our copy, and when.** The file carries no date, and the route from DEC's tape to a PC disk is unknown (see [ABOUT.md](ABOUT.md)).
- **Should a Daily count from the first move?** Today only a finished game is recorded, so a player can restart a losing Daily. Recording the attempt when the first stick is taken would close that, at the cost of a lost Daily when the tab is closed by accident.
