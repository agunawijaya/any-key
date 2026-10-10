# Outta Here: notes

The lab book: what we know about *Escape* and how we know it, what Outta Here does with each of its quirks, and the numbers behind the balance. The longer explanations live in [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md) (the original) and [ARCHITECTURE.md](ARCHITECTURE.md) (the rebuild).

## Verified facts about the original

Every fact below comes from reading `escape.bas` (kept read-only, outside the repo) on 7 October 2026, with the line numbers given. "Simulated" means a check in `scripts/check-outta.ts` passes against `Escape1980`, our model of the listing: that confirms the model follows our reading, not that a TRS-80 behaves this way. Nothing here has been run on a real machine or in an emulator yet (see *Open questions*).

1. **Size and form.** Eleven numbered lines (10, 20, 22, 30, 35, 40, 50, 60, 70, 80 and 100), 408 bytes of plain text with CR LF line endings, not tokenised, every optional space removed. Verified by the file's byte count and a byte-by-byte dump.
2. **Line 80 arrives in two pieces.** The string line 80 compares the key with holds a CR LF in our copy, so the file has twelve physical lines for eleven program lines. On a TRS-80 that character was the down arrow's code, a line feed (10). Verified by the byte dump (the break sits between the two quotes); the key code is from the Technical Reference Handbook.
3. **The screen is the board.** Line 20 sets `P` to 15360 (3C00 hex), the top-left cell of video memory. Lines 30 and 35 read and write cells with `PEEK` and `POKE`; the program has no array. Verified by reading.
4. **`*SCAPE`.** Line 10 clears the screen and prints the title on the top row; the first pass through line 35 writes the star (code 42) at 15360, over the title's first letter. Verified by reading lines 10 to 35; simulated.
5. **The first erase goes to ROM.** `PP` is not set before line 35 first runs, and BASIC starts numeric variables at zero, so line 35 first writes a space to address 0, which is ROM and ignores it. Verified by reading lines 20 to 35.
6. **The exit.** Line 22 writes a `+` (43) at 16320 + 30 = 16350: row 15, column 30. Line 100 compares `P` with the same sum. Verified by reading; simulated.
7. **The rain.** Line 40 copies `P` to `PP`, reads `INKEY$`, and only when no key is waiting writes 191 (a solid block) at `RND(1024-64)` + 15360, then jumps back to itself. Level II's `RND(n)` gives 1 to *n*, so blocks land from 15361 to 16320: never the top-left cell, never the bottom row apart from its first cell, never the exit, and possibly on the star or the title. Verified by reading line 40 and the Level II manual's `RND`; simulated over 20,000 blocks.
8. **Left and right test the same cell.** Lines 50 and 60 both refuse a step only when `P` is 15360. Verified by reading; simulated (no step right from the first cell, and the wrap from one row's end to the next row's start).
9. **Up tests a row above the screen.** Line 70 refuses a step only when `P` is below 15360 − 64 = 15296, so the first two steps up from the top row are allowed and the third is refused. Verified by reading; simulated.
10. **Down lets one cell through.** Line 80 refuses a step only when `P` is above 16384 − 64 = 16320, the bottom row's first cell. From 16320 (down) and from 16383 (right, by line 60), `P` reaches 16384, the first byte after the screen, and line 35 writes the star there. Verified by reading; simulated (both crash).
11. **Blocked moves and buried stars.** Line 30 puts `P` back to `PP` when the target cell holds 191; line 35 then writes a space at `PP` and the star at `P`. A key that isn't one of the four falls through lines 50 to 80, passes line 100 and returns to line 30, so it redraws the star over a block that has landed on it. Verified by reading; simulated.
12. **The end.** Line 100 runs `END` as soon as `P` equals the exit, before line 35 can draw the star there. BASIC's prompt then appears on the row under the title, where line 10 left the cursor. Verified by reading; simulated.
13. **The keys.** The program compares `I$` with comma, full stop, `[` and a line feed, and nothing else. The TRS-80 sends 91 (`[`) for the up arrow and 10 for the down arrow; its left and right arrows (8 and 9) are never tested. Verified by reading lines 50 to 80; key codes from the Technical Reference Handbook.
14. **Three variables, four characters, one message.** The only variables are `P`, `PP` and `I$`; the only characters written are 42, 43, 32 and 191; the only `PRINT` is the title on line 10. No score, no timer, no win or loss message. Verified by reading.

## Quirks and bugs

| Quirk | Why (lines) | In 1980 mode | In the modern modes |
|---|---|---|---|
| Rows wrap at both ends | Lines 50 and 60 only guard 15360, and the rows sit end to end in memory | Kept exactly | Kept as **edge tunnels**, with visible seams; none left from the top row or right from the bottom row |
| No step right from the very first cell | Line 60's test was copied from line 50 | Kept | Gone |
| The star vanishes above the top row | Line 70 tests 15296, a row above the screen; the keyboard's memory ignores writes | Kept: two rows deep, invisible, and the readout says where the star is | Kept as **under the keys**: one row, a visible keyboard, out of reach of chasers, rain and bombs |
| The star can drift further down memory | A step left is refused only at 15360, so from the keyboard rows it can keep going | Kept as far as the address goes; writes below the screen do nothing | Gone: the keyboard row ends at both edges |
| Stepping off the bottom corners crashes the machine | Line 80's test lets 16320 through, line 60 lets 16383 through, and 16384 starts BASIC's working memory | Kept, with our impression of the crash | The way out of The Last Machine's screens |
| The bottom row stays clear | Line 40's range stops at 16320 | Kept | Kept on Chill only |
| A block can land on the star, and any key wipes it off | Line 40 never checks the cell; lines 30 and 35 redraw | Kept | Only on Hard, where it costs a heart and nothing wipes it |
| Pressing keys holds the rain back | Line 40 takes a key or drops a block, never both | Kept: one key per loop | Replaced by the hesitation meter: moving keeps the rain light |
| The title gets eaten | Line 40's range includes the title's cells | Kept | No title on the screen; the letters are things to collect |
| A block on a block changes nothing | Line 40 writes without looking | Kept | Rain never lands on a block |
| Line 80 is split in our copy | A line feed became CR LF somewhere between 1980 and us | Not reproduced: the model uses the intended line feed | Not applicable |

## Simulations

All numbers below come from one run of the check on 10 October 2026, after the Mega bomb and the Copycat were added (backlog items BL-006 and BL-002):

```text
npm run check:outta
```

It runs `tsx scripts/check-outta.ts` (an optional argument sets the runs per difficulty; the default is 120) and took about a minute. Every check passed.

### Rules, Daily, 1980 mode, the Mega bomb and the Copycat

- A way out exists at the start of all 500 Normal screens tried (seeds 1 to 500).
- Two Hard games with seed 42, each played by a bot with the same seed, end 40 seconds later with the same grid, the same star position and the same state.
- Edge tunnels, the keyboard row, wood pushing, bomb reach (a plain bomb breaks 1 block of a row of 10 glass, a chain bomb all 10), the refused push and the keyboard row as a way round all behave as specified.
- The Mega bomb: around a star with wood, glass and stone on all sides, a bomb breaks the 2 glass blocks and leaves 3 wood and 3 stone; a Mega bomb breaks all of them, the 2 stone included, and not the stone one cell further out. It uses no regular bomb, and its glass counts for the score. Taking one carries it and places the next somewhere else at once; with one in hand the next stays put. One walled in by a landing block moves where you can reach it. Chill has none.
- The Copycat: it braces for 0.45 s and then pushes wood one cell; it doesn't even brace for a push that would box you in; it arms for 0.75 s, drops its bomb against a glass wall, breaks only glass and is out of the blast when it goes off; it bombs you through glass when you can step clear, and not when you are in a pocket with no free cell.
- The Daily gives one seed per calendar day: #274 on 1 October 2026 at 8:00 and 23:00, #275 the day after. The share text has ten squares.
- 1980 mode: `*SCAPE` and the `+` at the start; no step right from the first cell; two rows into the keyboard's memory and back; the row wrap; the crash from both corners; 20,000 blocks with none on the bottom row (bar its first cell) or the exit; any key clears a buried star; the exit ends at `READY`.

### Human-like bots on each difficulty

`HumanBot` with 0.35 s reaction and a step about every 0.16 s, 120 runs per difficulty (Game seeds 1001 to 1120, bot seeds 1 to 120), each run stopped at 240 s.

| Difficulty | Got out | Median time | Hits a run | Bombs a run | Hits by cause, all runs |
|---|---|---|---|---|---|
| Chill | 100% | 15.8 s | 0.00 | 0.0 | none |
| Normal | 84% | 49.3 s | 1.24 | 6.2 | Eraser 85, Bouncer 46, own bomb 18 |
| Hard | 33% | 38.3 s | 1.55 | 4.2 | Eraser 77, Bouncer 47, Copycat 21, own bomb 16, Glitch 14, rain 11 |

"Bombs a run" counts your regular bombs and Mega bombs, not the Copycat's. On Chill the bot never needs a bomb. Normal's median (49.3 s) is just above its par (45 s), and Hard's (38.3 s) below its par (50 s), because on Hard the long runs are the ones that end in a catch. Before the Mega bomb and the Copycat (7 October 2026) the same runs gave Normal 80% (median 58.6 s) and Hard 31% (median 52.8 s); Chill is unchanged to the last digit.

In the same runs:

| | Normal | Hard |
|---|---|---|
| Mega bombs taken a run | 1.34 | 0.82 |
| Mega bombs dropped a run | 1.23 | 0.72 |
| Stone broken a run | 4.04 | 2.48 |
| Copycat pushes a run | | 2.26 |
| Copycat bombs a run | | 0.22 |
| Hits from the Copycat's bombs | | 0 |
| Copycat caught in a blast | | 3 times in 120 runs |

And checked once a second in every one of the 360 runs: there is always exactly one Mega bomb on the screen (on Normal and Hard), always on an empty cell off the walls that you can reach; every Copycat push came at least 0.45 s after its brace and every Copycat bomb at least 0.75 s after it was raised; every Copycat blast broke glass only, without a chain; and no landing block and no Copycat push ever left you without a way out. No misses.

### Ten bots on each Screens screen

The table below is from 7 October 2026 and still holds exactly: the check folds the result of every one of these 300 runs, and of 40 Chill runs, into a fingerprint (`5d9572d`), taken with the engine and bot as they were before the Mega bomb and the Copycat. The new engine and bot give the same fingerprint, so Chill and every Screens screen play exactly as before, step for step.

Bot seeds 1 to 10 on each screen's fixed seed. Dives and tunnels are totals over the ten bots.

| Screen | Out of 10 | Median | Par | Dives | Tunnels |
|---|---|---|---|---|---|
| Green Screen 1 | 10 | 19.8 s | 25 s | 0 | 30 |
| Green Screen 2 | 10 | 22.6 s | 25 s | 0 | 20 |
| Green Screen 3 | 10 | 27.7 s | 35 s | 0 | 30 |
| Green Screen 4 | 10 | 29.9 s | 35 s | 0 | 10 |
| Green Screen 5 | 10 | 54.6 s | 65 s | 0 | 40 |
| Green Screen 6 | 10 | 38.3 s | 45 s | 0 | 20 |
| Amber Terminal 1 | 10 | 18.0 s | 20 s | 0 | 30 |
| Amber Terminal 2 | 9 | 31.5 s | 35 s | 0 | 40 |
| Amber Terminal 3 | 10 | 24.7 s | 30 s | 0 | 40 |
| Amber Terminal 4 | 10 | 34.1 s | 40 s | 0 | 30 |
| Amber Terminal 5 | 10 | 38.1 s | 45 s | 0 | 30 |
| Amber Terminal 6 | 10 | 45.3 s | 50 s | 0 | 40 |
| Home Micro 1 | 10 | 34.9 s | 40 s | 10 | 20 |
| Home Micro 2 | 10 | 35.2 s | 40 s | 10 | 1 |
| Home Micro 3 | 10 | 59.7 s | 70 s | 10 | 20 |
| Home Micro 4 | 10 | 68.6 s | 80 s | 10 | 36 |
| Home Micro 5 | 10 | 55.3 s | 65 s | 10 | 40 |
| Home Micro 6 | 10 | 52.2 s | 60 s | 10 | 30 |
| Pocket LCD 1 | 10 | 32.1 s | 40 s | 0 | 20 |
| Pocket LCD 2 | 10 | 22.3 s | 25 s | 0 | 40 |
| Pocket LCD 3 | 10 | 57.1 s | 65 s | 10 | 52 |
| Pocket LCD 4 | 10 | 51.6 s | 60 s | 0 | 30 |
| Pocket LCD 5 | 10 | 44.5 s | 50 s | 0 | 28 |
| Pocket LCD 6 | 10 | 36.2 s | 40 s | 0 | 40 |
| The Last Machine 1 | 10 | 28.9 s | 35 s | 0 | 30 |
| The Last Machine 2 | 10 | 35.1 s | 40 s | 17 | 20 |
| The Last Machine 3 | 10 | 35.4 s | 40 s | 0 | 10 |
| The Last Machine 4 | 10 | 32.6 s | 40 s | 0 | 0 |
| The Last Machine 5 | 9 | 54.1 s | 60 s | 0 | 22 |
| The Last Machine 6 | 10 | 41.0 s | 50 s | 0 | 10 |

Every screen's median is under its par, as it should be: the pars were set at the bots' median plus a tenth, rounded up to five seconds. On every Home Micro screen the ten bots dived under the keys ten times between them; on every Amber Terminal screen they took 30 to 40 tunnels between them.

## Designing the Copycat and the Mega bomb

Both came from the owner's backlog on 9 and 10 October 2026: a chaser that plays by your rules (BL-002) and a bomb you have to go and fetch that breaks stone (BL-006). These are the trials behind the numbers in `levels.ts` and `engine.ts`, all with the human-like bot, 120 runs unless the line says otherwise. They are kept here because each one was a real choice.

### Where the Mega bomb waits

The brief warned that the Mega bomb must stay "a treat, not a trivializer". On Normal (no Copycat), with the bot fetching a Mega bomb whenever the detour costs 14 or less:

| First one, next ones | Got out | Median |
|---|---|---|
| No Mega bomb at all | 80% | 58.6 s (identical to before) |
| 24 to 70 steps away, then at least 18 | 95% | 50.7 s |
| The same, but the bot never makes a detour for it | 85% | 58.7 s |
| 40 to 90 steps away, then at least 30 (chosen) | 84%, and 87% over 300 runs | 49.3 s |
| 50 to 110 steps away, then at least 36 (300 runs) | 87% | 47.1 s |

Close by, it took Normal to 95%: a hole through a wall saves a whole corridor, and a human goes for anything shiny that is near. Placed a good walk away it lifts Normal by about seven points, and putting it further still changed nothing. The check's band for Normal was 55 to 85%; it is now 55 to 90%, a choice made here and reported to the owner. On Hard alone (no Copycat) the Mega bomb lifted the bots from 31% to 46%, which is where the Copycat comes in.

### Where the Copycat starts, and how fast it is

On Hard, with the Mega bomb:

| The Copycat | Got out | Its catches |
|---|---|---|
| None | 46% | |
| Low on the screen, above the last wall, a step every 0.34 s | 23% | 61 |
| The same, slowed to 0.45 s and 0.55 s a step | 23% and 28% | 54 and 46 |
| The middle corridor, 0.34 s | 11% | 102 |
| The second corridor, 0.34 s | 20% | 85 |
| The start corner, 0.34 s | 37% | 2 |
| The start corner, 0.26 s | 34 to 40% | 10 to 15 |
| The start corner, 0.22 s, setting off at 8 s (200 runs) | 36% | 33 |
| The start corner, 0.2 s, setting off at 6 s (200 runs) | 31% | 45 |
| The start corner, 0.22 s, setting off at 7 s (chosen) | 33% | 21 |

In front of you it is a goalkeeper you have to get past, and even slowed down it caught the bots four to ten times as often as Glitch. Behind you it is the right kind of threat for a copycat: it starts where you started and comes down your way, and it only catches a player who dawdles or waits too long for a fuse. Hard ends up where it was before both features (31 to 33%), so the Mega bomb's help and the Copycat's threat about cancel out.

### Making it use its tools

With its first route costs (a push 3, glass 12) the Copycat pushed wood only 0.4 times and bombed 0.17 times a run, mostly walking the path you had already cleared. Cheaper tools (a push 2, glass 7) and the change below brought it to about 2.3 pushes and 0.2 bombs a run without changing the escape rate. It still bombs rarely, because from behind most glass on its way has already been broken by you; it bombs when the rain drops glass in its path or when a glass shortcut saves it a long way round.

A trace of one run found the Copycat standing still for 30 seconds: the Eraser was stuck in a one-cell hole in a wall (its trail blocked by wood below), and the Copycat's planner counted the Eraser as a wall, so the only way down was closed. Other chasers now cost a wait (8) instead of being walls, except on the very first step.

### Fairness

- Bombing a glass wall next to a player in a pocket would leave them nowhere to go, so a glass bomb whose blast would reach you needs the same test as an attack: a free cell out of the blast within six of your steps (or the keyboard row above you).
- The bots never took a hit from a Copycat bomb in 360 runs: the 0.75 s with the bomb held up, plus the 2.5 s fuse, are enough for a player who reacts 0.35 s late.
- Copy That (the Copycat caught in a blast) came up in 3 of 120 Hard runs for bots that weren't trying: rare, as its tier says. Once it was the Copycat's own bomb, when it had nowhere to back off to; twice the bot's.

## Regression checks

| Check | What it locks | Tolerance |
|---|---|---|
| `npm run check:outta`, rules | A way out at the start of 500 Normal screens; seed replay; tunnels; keyboard row; wood; bomb reach; refused push | Exact: all 500, and every rule as specified |
| `npm run check:outta`, Daily | One seed per calendar day, the next day's number one higher; ten squares | Exact |
| `npm run check:outta`, 1980 mode | The quirks and endings listed under *Simulations* | Exact |
| `npm run check:outta`, balance | Bot escape rate on each difficulty | Chill 90–100%, Normal 55–90% (85% until the Mega bomb), Hard 25–60% |
| `npm run check:outta`, Mega bomb | Reach and blast of a bomb and a Mega bomb; carrying, the next one appearing elsewhere, hands full; moving one that is walled in; none on Chill | Exact |
| `npm run check:outta`, Copycat | The brace before a push; no push that would box you in; the bomb held up, glass only, getting clear; bombing you only when you can step clear | Exact |
| `npm run check:outta`, every bot run | One Mega bomb at all times on a reachable empty cell; every Copycat push and bomb shown first; its blasts glass only; the way out never shut | No misses |
| `npm run check:outta`, fingerprint | Chill (40 runs) and the 300 Screens runs play exactly as before the Mega bomb and the Copycat | Exact: `5d9572d` |
| `npm run check:outta`, Screens | Thirty different seeds; at least 5 of 10 bots out on every screen; on the Amber Terminal at least one tunnel, on the Home Micro at least one dive | At least 5 of 10 |
| `tests/unit/dailies.test.ts` | The Daily for 7 October 2026 at noon: #280, key `2026-10-07`, seed 79599 | Exact |
| `tests/unit/daily.test.ts` | The kit's numbering: 1 January 2026 is #1, 7 October 2026 is #280 at any hour, and the old formula matches on every day of two years at four hours each | Exact |
| `tests/unit/rng.test.ts` | `mulberry32(12345)`'s first four numbers, the generator behind every seed | Exact |
| `tests/unit/migration.test.ts` | A version 1 save (40 runs, 22 escapes, best times, three screens, two dailies, six keycaps, Hard picked) reads the same after the move; the old key is untouched; the Keyring imports six keycaps and the dailies once; forgetting Stickler leaves Outta Here alone | Exact |
| `tests/unit/manifest.test.ts` | The twelve keycap titles and hints, as they were before the kit; unique ids; known tiers | Exact |
| `tests/e2e/navigation.spec.ts` | Back mid-run asks first; the pause menu's items and order; `Esc` after a 1980 crash goes to the game menu | Exact |
| `tests/e2e/keyring.spec.ts` | Stepping off the bottom-left corner in 1980 mode unlocks Crash Test | Exact |
| `tests/e2e/story.spec.ts` | Every Story chapter renders and every Mermaid diagram in it draws | Exact |

The bot medians are reported but not locked. The Screens are locked twice: a change that moves a screen below five bots in ten fails, and any change at all to how Chill or a screen plays fails the fingerprint. If that change is meant, re-pick the screens' seeds and take a new fingerprint.

## Open questions

- **The Copycat beyond Hard.** It is on Hard only (and so in Versus on Hard). Putting it on Normal would change the Daily, and putting it in the Screens would mean picking their seeds again. Whether the owner wants it elsewhere is open.

- **How fast did the loop really run?** We estimate 50 to 70 times a second and use 60. Timing the program in a TRS-80 emulator with an accurate clock (or on a real Model I) would settle it.
- **The `ELSE` pairing.** We read each `ELSE` on lines 50 to 80 as belonging to the inner `IF`, the only reading under which the program works. Running the program in an emulator would confirm it.
- **What did the crash look like?** Writing 42 over the first byte of BASIC's working memory breaks it, but whether a Model I froze, restarted or printed rubbish depends on what that byte does next. An emulator run of the down step from the bottom-left corner would show it.
- **What does line 30 read in the keyboard's memory?** A read there returns the state of keys held down, not a character, so it is very unlikely ever to be 191 and refuse a move. We have not tested it.
- **How far can the star drift?** Pressing comma from the keyboard rows walks the address down towards the device area below the keyboard, where an expanded machine had memory-mapped hardware. Whether writing a space or a star there did anything is untested.
- **Did a TRS-80 lose keys in a fast burst?** `INKEY$` only looks at the keyboard when line 40 runs. Our 1980 mode queues every press; a real machine may have dropped some.
- **Who wrote it, and where was it published?** See [ABOUT.md](ABOUT.md). A matching listing in a magazine, book or user-group disk would answer it.
- **Re-picking the Screens' seeds.** The picks and pars are fixed in `lib/outta/campaign.ts`, but the run that chose them is not kept as a script; if an engine change ever pushes a screen below five bots in ten, that picking loop has to be rebuilt (try seeds in order, keep the first that is winnable enough and, on the Amber Terminal and the Home Micro, makes the bots use the trick).
