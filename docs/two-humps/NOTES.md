# Two Humps: notes

The lab book: what we verified about the 1982 program, how, and the simulations behind Two Humps' balance. Line numbers are the BASIC listing's. The listing itself stays outside the repository; everything here is in our own words.

## Verified facts about the original

All read from `DESERT.BAS` (255 lines, IBM BASICA), unless a line says otherwise.

1. **Credits.** The title screen calls it program #2004 of the IPCO Personal Computer Owners Group, Pittsburgh (lines 130–180), and a remark says it was translated by IPCO in February 1982 (line 350). The listing names no author.
2. **Six commands on the function keys.** Lines 240–300 label F1 to F6 drink, moderate speed, full speed, stop, status and hope; F7 is blanked.
3. **Starting state.** The subroutine at 2610 sets six drinks (S), four turns of water (Z), mile 0 for you (C) and for the pursuers (C1), fatigue (F) and the turn counter (P) to zero, and the captive flag (Q) to zero.
4. **The goal.** At the top of every turn (line 940) the program checks for more than 39 miles. The check runs before thirst and before the pursuers move.
5. **Water.** Each turn takes one from Z (line 950). At one there is a warning (960–1030); below zero you die of thirst (1040). So you can go four turns without a drink and die on the fifth. A drink (1540–1580) costs one of six and resets Z to four, and it doesn't use up a turn: the program goes straight back to asking for a command.
6. **Moves.** Moderate speed (1320–1380) adds one to F, and the camel dies when F reaches exactly 8. It covers INT(10 × RND) miles: 0 to 9. Full speed (1390–1470) adds three to F, and the camel dies when F is over 7. It covers 2 × INT(10 × RND) miles: 0 to 18, always even. Stopping for the night (1480–1500) sets F to zero, but the turn still passes.
7. **The pursuers** take a step of INT(10 × RND) + 2.5 miles every turn (1060). That is 2.5 to 11.5, which is why their distance always prints with a half. The step is drawn every turn, but it is only added from the fourth turn on (1080–1090). They catch you when their total reaches yours (1100); the status line shows the gap only after they set off.
8. **The events after a move** (the subroutine at 1590), with the odds the code gives them:

   | Roll | Line | Happens | Chance |
   |---|---|---|---|
   | INT(100 × RND) ≤ 5 | 1600 | Ambushed (see 12) | 6.0% |
   | then INT(10 × RND) ≤ 2 | 1950 | Oasis: canteen back to six, thirst reset | 28.2% |
   | then INT(100 × RND) ≤ 5 | 2110 | Sandstorm: you move 0–9 miles forward or back, and can end up below zero | 3.9% |
   | then INT(100 × RND) ≤ 5 | 2220 | Hurt hump (see 13) | 3.7% |
   | otherwise | 2220 | The command runs again (see 9) | 58.1% |

9. **The repeat.** When no event fires, line 2220 jumps to the command dispatcher at 1250 (`ON Y GOTO`) without returning from the subroutine. The same command starts again from the top, adding fatigue and rolling for events again. Moves call the event subroutine *before* they add their miles (1340 and 1410 come before 1350 and 1420), so a stride that repeats never adds its miles. **Only the last stride of a repeated move counts.** The repeats are invisible: nothing is printed for them. This corrects our brief, which expected them to give free miles: they cost fatigue and pay nothing, though they do skip the water and pursuer updates.
10. **The stack.** Each repeat leaves one return address on BASIC's stack that is never removed, and so does every ambush. Over 40,000 simulated games the deepest pile was 22 addresses (median at the end of a game: 4). That is far below what the interpreter's stack holds, so long games don't crash for this reason.
11. **Status costs a drink.** The status report (1510–1530) has no `GOTO` at its end and runs on into the drink routine, so asking for status uses a drink and resets the thirst count.
12. **Ambushes.** A capture event offers two sub-commands (1650–1730). Anything except exactly 8 counts as an escape attempt (1740), and an escape fails half the time (1750–1760), which is fatal. Waiting (8) either ends with a ransom paid (a 25% roll at 1840) or with a message to keep waiting (1900), and both go straight on to the next turn. The captive flag that should hold you (Q, tested at 1070) is never set anywhere, so **waiting is always safe**.
13. **The hurt hump.** Its message calls it a lucky break, but the code adds a mile to the pursuers' total (2230).
14. **Hope for help** (1260–1310): one chance in ten (INT(10 × RND) = 1) of rescue with three drinks and thirst reset; otherwise you die.
15. **Typos call for help.** `ON Y GOTO` falls through to line 1260 for 0 and for anything above 6, so any number other than 1 to 6 is a call for help. A negative number stops the program with an "Illegal function call" error (behaviour of BASICA's `ON`, from its manual).
16. **An empty canteen is fatal.** Drinking with no drinks left takes S below zero, and line 1550 treats that as death rather than a warning.
17. **Endings.** Reaching the goal prints a banner, says a party is being held and that the pursuers plan to come (2030–2090). Every death picks one of five closing remarks at random, each 20% (2260–2430). Being caught by the pursuers prints its own message and skips the closing remarks (1110–1190). At "play again", only a capital Y restarts (2500); anything else ends with a one-word taunt (2540–2600).
18. **The same desert every time.** There is no `RANDOMIZE`, so in a freshly loaded BASICA the dice fall the same way game after game.
19. **Content we left behind.** The pursuers are a tribe of "pigmies" who want to cook you, the ambushers are named after a real people, a sheik and a sultan negotiate a ransom, and the closing remarks mock the dead. None of it is in our game; CHANGES-FROM-ORIGINAL.md says what replaced it and why.
20. **The function keys type words.** `KEY n, text` makes a soft key type its text, and the six texts are the command names, not their numbers. Pressing one at the numeric `INPUT` (line 1240) would get BASICA's "?Redo from start", so the key line is only a reminder and players typed the numbers. From the code and BASICA's documentation; not run.

### How these were checked

Facts 1–9, 11–19 and 20 come from reading the listing line by line. Our 1982 module (`lib/two-humps/original.ts`) follows the same lines, and `tests/unit/two-humps-original.test.ts` replays scripted dice through it to pin facts 4–9 and 11–16. The rates in fact 8 are worked out from the code. The repeat and stack figures in facts 9–10 come from simulating the module (below). Fact 15's error, for negative numbers, comes from BASICA's documented behaviour for `ON … GOTO`, not from running the program.

## Quirks and bugs, and what Two Humps does with them

| Quirk | In 1982 | In Two Humps |
|---|---|---|
| The repeat (9) | Hidden, costs fatigue, pays no miles | The heart of the game, made fair: the camel visibly runs on, every stride pays miles and costs fatigue, no water or time, and you can pull the reins. 1982 mode keeps it exactly, with a line under the screen that shows the hidden repeats |
| Status costs a drink (11) | Yes | Scan costs a sip (it doesn't quench). 1982 mode keeps the original |
| Typos call for help (15) | Yes | Commands are buttons and keys 1–6, so there are no typos. 1982 mode keeps it, and the secret keycap Typo is for doing it by accident |
| Waiting is always safe (12) | Yes | The lost-caravan event: waiting is always safe but the pursuer gains a step, chasing is a gamble. 1982 mode keeps the original |
| Hurt hump moves the pursuers closer (13) | Yes | Gone; the sore hump just slows your next stride, and says so. 1982 mode keeps the original |
| Sandstorm can push you below zero | Yes | Gusts move you at most six miles and never below zero |
| An empty canteen kills (16) | Yes | Drinking from an empty canteen just doesn't work |
| Same dice every load (18) | Yes | Every trek has its own seed; the Daily Crossing has the day's |

## Simulations

All from `npx tsx scripts/check-two-humps.ts` (1,500 crossings per cell unless noted; half start at dawn, half at dusk). The "sensible" bot is the brief's: it drinks at the warning, makes camp at fatigue 5, gallops only on a fresh camel and lets the camel run on only while the next stride leaves fatigue at 5 or less.

### The sensible bot against the targets

| Pursuer | Chill (target) | Normal (target) | Hard (target) |
|---|---|---|---|
| The Haboob | 79.3% (70–80) | 61.2% (55–65) | 47.9% (40–50) |
| The rival caravan | 66.5% (65–75) | 59.2% (50–60) | 38.3% (35–45) |
| The Ladle Gang | 55.3% (55–65) | 46.4% (40–50) | 31.7% (25–35) |

Dawn and dusk starts stay within about ten points of each other on Normal (Haboob 64.9/55.1, rival 48.8/61.1, gang 39.2/53.5). Without help they wouldn't: in early tuning the rival was 35% from dawn and 80% from dusk, because a dusk start gave you a free night while the rival slept. So pursuers start differently by time of day: starting at dusk, the rival left at dawn and is camped 8 miles ahead, and the gang's burrows are 8 miles back.

The median winning crossing on Normal takes **10 turns** of two hours (target 10–14), counting a night's sleep as the turns it lasts.

### Other players

| Player | Haboob | Rival | Gang |
|---|---|---|---|
| Random (any legal command, coin flips) | 6.2% | about 7% | about 6% |
| Best plan found by search (Normal) | 85.6% | 82.7% | 91.3% |

The best plans: against the Haboob, gallop while fatigue is 2 or less, camp at 6, let the camel run on to 7, and rest by day instead of sleeping through the night. Against the rival, the same but camp only at 7. Against the gang, never gallop, camp early (at 3), run on to 5 and never sleep at night. The gap between the sensible bot and the best plan, 25 to 45 points, is room for skill.

### No blind routine wins

Fixed orders of moves that ignore the state (drinking only at the warning, never running on) top out at 61.6% (gallop, gallop, camp against the rival); the limit is 80%.

### The Expedition

| Leg | Pursuer | Twist | Sensible bot, Normal |
|---|---|---|---|
| 1. Khermen Tsav | Haboob | No galloping | 82.8% |
| 2. Khongoryn Els | Haboob | Singing dunes (20% per stride) | 71.7% |
| 3. Bayanzag | Rival | Fossils | 43.3% |
| 4. Yolyn Am | Ladle Gang | No thirst, strides 15% shorter | 57.1% |
| 5. The ger camp | Ladle Gang | Signals answered 40% of the time | 70.5% |

Every leg clears the 40% floor.

### The 1982 program, simulated

From our 1982 module, which follows the listing step for step (40,000 games per player for the detailed figures).

| Player | Wins | Mean game | How games end |
|---|---|---|---|
| Random (commands 1–6 at random) | 0.2% | 2.4 turns | died calling for help 50%, camel 31%, caught 16% |
| Sensible (drink at the warning, camp at 5, never gallop) | 2.0% | 4.7 turns | caught 76%, camel 22% |
| Best simple policy found | 5.6% | 3.4 turns | camel 63%, caught 32% |

The best simple policy gallops on a fresh camel, camps at fatigue 4 and drinks only on the last safe turn. The 1982 program is very hard to win: from the fourth turn the pursuers average 7 miles a turn, while a walking camel averages 4.5 and every repeat costs fatigue for nothing.

- **Repeats per move**: 1.29 on average in play (1.39 in theory; deaths cut some runs short). Sensible play: no repeat 42%, one 24%, two 14%, three or more 20%.
- **A fresh camel's first gallop kills it** in 34.1% of 30,000 trials. In theory two repeats in a row: 0.581² = 33.8%. The brief expected about a third.

## Performance

Measured on the production build in headless Chromium, with the GPU (an RTX 4060 laptop GPU through ANGLE and
Direct3D 11) and without (SwiftShader, software only), by counting animation frames for three seconds. The trek was
a fresh Crossing against the Haboob, the storm 11 miles behind.

| Screen | 1920 × 1080, GPU | 2560 × 1440, GPU | 1920 × 1080, software |
|---|---|---|---|
| Game menu, light | 60 | 52 | about 20 |
| Trek, light (dawn) | 60 | 54 | 20–39 |
| Trek, dark (dusk, stars out) | 60 | 53 | about 19 |
| Trek against the rival, dark | 60 | 56 | — |

Before the two caches (the backdrop and the storm buffer), the 1440p storm at dusk ran at 34 frames a second. Most
of a frame's cost is painting pixels, not JavaScript: a CPU profile of the software case puts 83% of the main
thread in native drawing and under 5% in our own code.

## Regression checks

| Check | Locks | Tolerance |
|---|---|---|
| `scripts/check-two-humps.ts` | Every cell of the table above against its target; median crossing 10–14 turns; routines under 80%; every Expedition leg at least 40%; the Daily plays the same twice and rotates its pursuer; the 1982 first-gallop death rate | Targets ± 3 points; the 1982 rate ± 2 points of theory |
| `tests/unit/two-humps-original.test.ts` | Facts 4–9 and 11–16 with scripted dice | Exact |
| `tests/unit/two-humps-engine.test.ts` | Determinism; a run-on stride costs no water, time or pursuer move; collapse past seven; illegal gallop says why; oasis refill; seeds; the rival drying oases; the Daily; balance on Normal; every Expedition leg; the tutorial's dice at dawn and at dusk | Balance ± 7 points (400 crossings); legs above 36% (300 crossings) |
| `tests/e2e/two-humps.spec.ts` | Every mode by mouse and by keyboard alone, the tutorial, the reins, seeds, every way out | — |

## Open questions

1. **Who wrote the first version?** The IPCO listing names no author. *Camel*, printed in David Ahl's *More BASIC Computer Games* (1979) with the idea credited to the Heath Users Group, has the same premise over 200 miles: the Gobi, a camel, six drinks, a tribe of pursuers, oases, sandstorms and ambushes. *Desert* is almost certainly an adaptation of it, but we found nothing that says who made the IBM version. Our brief says later ports credit *Camel* to Cary Torkelson; we found no source for that and don't repeat it in the game. The book's own credit page, or a dated HUG listing, would settle it.
2. **Rounding of fractional commands.** `ON` rounds a non-whole command (2.6 picks 3). We assume BASICA rounds halves up; we haven't run it.
3. **The interpreter's stack.** We know the pile of return addresses never passes 22 in simulation; we haven't measured how many BASICA can hold.
