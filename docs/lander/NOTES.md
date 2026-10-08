# Don't Crater: notes

The lab book: what we know about the original and how we know it, the quirks and what became of them, and the simulations behind the balance. Line numbers are the BASIC line numbers of `lander.bas` (read in place, outside the repository). "Simulated" means the turn arithmetic as re-built in `lib/lander/original.ts`, run with `tsx`. The chapters with the full story are [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md) for the original and [ARCHITECTURE.md](ARCHITECTURE.md) for the rebuild.

## Verified facts about the original

1. **Shape.** 113 lines, numbered 74 to 9007. Line 74 jumps to 85; the title routine at 75–76 is reached only by the call on line 87. *Read in the source.*
2. **Instructions only on a 1.** Line 75 sets a flag only when the answer is exactly 1, and line 92 shows the instructions (9000–9007) halfway through building the pictures. Any other number skips them. *Read.*
3. **The worlds.** Lines 500, 600, 700 and 800 set gravity (cm/s²) and radius (km): Earth 980.7 and 6,371, Moon 162 and 1,738, Mars 374 and 3,380, Asteroid Alpha 17.5 and 195, and the name shown on the bottom row (line 147). *Read.*
4. **The recipe.** Lines 150–180: gravity divided by 36; starting height the whole part of 100 × √gravity, at least 175; fuel the whole part of 55 × height, at least 10,000; engine fuel × ln(cm/s² gravity) / 20 + 10,000. Earth starts at 521 km with 28,655 fuel and an engine of 19,869.2; the Moon at 212 km, 11,660, 12,966.1; Mars at 322 km, 17,710, 15,245.9; the asteroid at both floors, 175 km and 10,000, with 11,431.1. *Read, and simulated; `check-lander.ts` pins Earth and the asteroid.*
5. **The constants.** Line 190: −6,400 for the distance sum, 5,000 km/h entry speed, 15,000 dry mass, 10-second turns. *Read.*
6. **A burn of 0 is special.** Line 250 sends a zero burn straight to the arithmetic, past both the range check (260) and the turn shortening (270). *Read.*
7. **The turn shortens once.** Line 270 shortens the turn to fuel ÷ burn when that is under 10 s. Only line 200, at the start of a game, sets it back to 10. *Read.*
8. **Fuel first, then the push.** Line 280 takes the burn out of the tank before line 290 works out the acceleration, so each turn's push uses the lighter, end-of-turn mass. *Read.*
9. **Height from the average speed.** Line 300 changes the height by (start speed + end speed) × turn ÷ 6,400 (that is, average speed ÷ 3,200 per second). *Read.*
10. **Touchdown before the tank.** Line 307 checks for a height under 0.01 km before line 310 checks for an empty tank, so a touchdown on the last drop of fuel is a landing, not a fall. *Read.*
11. **The touchdown estimate.** Line 450 uses the height at the start of the last turn (saved on line 298), that turn's acceleration, and the speed at the end of the previous turn (saved on line 285). *Read.*
12. **The out-of-fuel fall.** Lines 400–420: fall speed √(speed² + height × gravity × 5,650); then the clock gains ln(speed in m/s × height × 10,000 ÷ gravity in cm/s²). *Read.* For any height above 10 m the logarithm's argument is above 1, so the clock never runs backwards. *Worked out by hand: at the smallest possible height the argument is at least 348 ÷ √(cm/s² gravity), about 11 on Earth.*
13. **The clock is never reset.** The elapsed time is only ever added to (lines 286 and 420); neither the world menu (100) nor the start of a game (200) clears it. *Read; `check-lander.ts` checks the carry-over in 1979 mode.*
14. **The previous game's last speed carries over.** Line 200 resets the speed at the start of a turn but not the end-of-turn speed, so a game that ended in its first turn would use the previous game's last speed in the touchdown estimate (0 in the very first game). *Read.*
15. **A refused burn.** Line 320 flashes the warning 20 times, sets the burn to 0 and goes back to the prompt; no time passes. *Read.*
16. **The verdict text.** Lines 1010–1050 pick the headline at 20, 100, 250 and 5,000 km/h; lines 1100–1160 pick the second line at 2, 5, 30 and 45. *Read.*
17. **The animation.** Line 8000 picks the explosion above 45 km/h, the wreck above 19, otherwise the cheer; line 8300 skips the flag above 5. *Read.*
18. **Zoom thresholds.** Line 7000 picks the ground by height (1, 10, 25, 50, 100 km); line 7200 steps the lander down at 0.8, 0.6, 0.3, 0.2 and 0.1 km. *Read.*
19. **Flame and dust.** The flame flickers burn ÷ 5 times (7000, 7100). In the lowest step the flame is not drawn; the dust flickers burn × 2 times instead (7260–7270). *Read.*
20. **Animation counts.** The explosion flashes 20 times (8100); the wreck's sparks rise in 9 rounds (a counter set to 8 on line 100 and counted down below zero on line 8200); the flag and the astronaut's arm swap 45 times (8320). *Read.*
21. **Random ground, once.** Lines 90–92 build the three highest ground strips with random rubble (the third only partly), once per run; the other ground pictures are fixed strings (93–99, 6000–6002). *Read.*
22. **Gravity weakens with height, four times too gently.** Line 290 multiplies gravity by 1 − height ÷ (2 × radius). It would turn negative above twice the radius: 390 km on the asteroid, which starts at 175 km. *Read.* That no flight can climb that far is our estimate, not a search: stopping the 5,000 km/h fall uses most of the asteroid's tank, and the program ends the game the moment the tank is empty (line 310), so there is no coasting upwards.
23. **Doing nothing strikes oil.** With every burn 0, the impact speeds are 10,670 km/h on Earth (22 turns), 5,562 on the Moon (13), 6,773 on Mars (18) and 5,046 on the asteroid (12). *Simulated; `check-lander.ts` pins them to within 1 km/h.*
24. **Full power from the start fails.** Burning 100 every turn runs every tank dry; the fall then hits Earth at 12,849 km/h (29 turns), the Moon at 2,884 (12), Mars at 6,783 (18) and the asteroid at 1,100 (10): oil, a crater, oil and a crater. *Simulated.*
25. **Every world can be landed.** A searched flight lands on Earth at −0.28 km/h (a hair below zero, which counts as excellent) in 45 turns. Flights with whole-number burns land on Earth at 0.003 km/h (35 turns, 23.2% of the tank left), the Moon at 3.17 (21 turns, 18.1%), Mars at 0.064 (27 turns, 28.0%) and the asteroid at 0.073 (20 turns, 12.0%). *Simulated; `check-lander.ts` checks all five.*
26. **Unused and unreachable.** Two picture strings built on line 89 are never used; a variable that holds a graphics string on line 89 is overwritten by the world's name (500–800); the string array is sized for 10 but only 7 are used (line 90). The `GOTO` after the fuel check on line 310 can never run (an `IF` whose test fails skips the rest of the line); nothing reaches lines 210, 460, 7010 (the `ON … GOTO` on 7005 always has a target) or 7150. *Read.*
27. **The `<16>` label.** Line 95 contains the four characters `<16>` inside a terrain string where the layout needs one. *Read.*
28. **The panel frame.** Line 145 sets pixels from x 87 to 126 and y 0 to 15, about columns 43 to 63 and rows 0 to 5; the values are printed at positions 109, 173, 237 and 301 and the prompt at 428. *Read.*
29. **Menus re-ask.** A world outside 1 to 4 returns to line 100, which clears the screen (140); a try-again answer outside 1 to 2 asks again (5000). *Read.*

## Quirks and bugs

| Quirk | Why (lines) | In Don't Crater |
|---|---|---|
| **Oil for doing nothing.** Everyone starts at 5,000 km/h and oil starts at 5,000, so a flight with no burns always strikes oil | Entry speed on 190, oil verdict on 1040–1050 | Kept in every mode: `check-lander.ts` checks that a no-burn flight strikes oil on every world. The oil ending (and a secret keycap) celebrates it |
| **Two cut-offs.** The wreck plays above 19 km/h, the crash text starts at 20 | 8000 against 1010 | 1979 mode only, with a secret keycap for landing in the gap. The modern modes judge everything at 20 |
| **Exactly 5 km/h** gets the "rough" line and the flag; **exactly 45** gets "no survivors" with only the wreck | 1110 and 8300; 1150 and 8000 | 1979 mode only. In the modern modes 5.0 km/h is Bumpy, with no flag |
| **The clock carries over** between games | Nothing resets it (100, 200) | 1979 mode only. Typing `RUN` after "no" starts a fresh clock, as running the program again would |
| **The previous game's last speed** can enter the first turn's touchdown estimate | 200 resets one speed but not the other | 1979 mode carries it, starting from 0 |
| **Gravity divided by 36**: every world at 77% of its real pull | 150 | Kept everywhere: the worlds are balanced on it |
| **3,200 seconds to the hour**: 12.5% more distance than the speed says | 300 | Kept everywhere, on both axes in Free Flight |
| **Weak height correction**, and gravity that turns negative above twice the radius | 290 | Kept. Psyche is small enough (radius 111 km) for a climbing lander to pass 222 km, so Don't Crater adds a "Lost in space" ending |
| **Approximate touchdown and fall formulas** | 450, 400–420 | 1979 mode only. The modern modes find the exact moment of contact and simulate the fall, which agrees with the 1979 shortcut to within 4% |
| **Dead code and unused strings** | 89, 90, 210, 310, 460, 7010, 7150 | Nothing to keep |
| **The `<16>` label** | 95 | Not relevant: no original data is used |
| **The "no survivors" line** printed mid-screen | 1160 prints at position 675; the other second lines at 64 | Not kept: 1979 mode prints it under the headline |
| **Twenty flashes** for a refused burn | 320 | 1979 mode flashes 6 times; the modern modes can't be given an illegal burn |

## Simulations

### The check script

```text
npm run check:lander
```

Run on 7 October 2026 from the repository root: **all checks passed** (exit code 0), in about 12 minutes. What it prints:

**Physics against exact formulas.** Free fall after 60 s: 570.0000 km/h against 570.0000. Touchdown 208.2070 s against 208.2070 s. A full tank in empty space: 7,456.97 km/h against the rocket equation's 7,456.97. The hover throttle holds 10 km/h to 9.9992. Halving the step size moves a 300 s Earth flight by 0.0006 m and 4.7 × 10⁻⁶ km/h.

**Full power from the start** (the most common first flight):

| World | Stops at | Ending | Simulated fall | 1979 shortcut |
|---|---|---|---|---|
| Moon | 135.9 km | crater | 2,807 km/h | 2,884 km/h |
| Mars | 231.3 km | oil | 6,678 km/h | 6,783 km/h |
| Psyche | 100.0 km | lost in space | | |
| Earth | 375.4 km | oil | 12,811 km/h | 12,849 km/h |

**Worlds** (perfect hoverslam, and a simple autopilot flying the game's physics):

| World | Start | Tank | Engine | Perfect run: brake at | Keeps | Lasts | Autopilot |
|---|---|---|---|---|---|---|---|
| Moon | 212 km | 11,660 | 12,966 | 86.1 km | 18.0% | 174 s | 1.41 km/h, 15.0% left |
| Mars | 322 km | 17,710 | 15,246 | 131.6 km | 29.0% | 236 s | 1.41 km/h, 24.4% left |
| Psyche | 175 km | 10,000 | 11,334 | 75.5 km | 10.3% | 153 s | 1.41 km/h, 9.9% left |
| Earth | 521 km | 28,655 | 19,869 | 313.0 km | 24.6% | 321 s | 1.40 km/h, 19.5% left |

**Missions** (perfect-run margin; autopilot touchdown and fuel left): First Contact 18.0% (1.41 km/h, 15.0%); Red Planet 29.0% (1.41, 24.4%); Metal World 10.3% (1.41, 9.9%); Homecoming 24.6% (1.40, 19.5%); Cargo Run 8.5% (1.41, 5.2%); Running on Fumes 19.0% (1.40, 14.1%); Hot Entry 9.8% (1.41, 7.0%); Instruments Out 29.0% (1.41, 24.4%); Needle 10.3% (1.41, 9.9%); Express Delivery 23.3% (1.40, 19.7%).

**Landing assist**, flying only by the green line: Moon 2.38 km/h with 17.0% of the tank left, Mars 1.20 (27.2%), Psyche 1.80 (10.1%), Earth 1.52 (20.7%). The amber line is checked from 4,800, 1,500, 300, 80 and 35 km/h on every world and every mission that allows the assist.

**Human pilots** (0.8 s late, whole-number throttle):

| World | Landing assist | Burn guide | No helpers |
|---|---|---|---|
| Moon | 4.8 km/h | 4.0 | 4.8 |
| Mars | 6.3 | 2.0 | 6.3 |
| Psyche | 2.5 | 2.0 | 2.5 |
| Earth | 11.4 | 14.0 | 11.4 |

Instruments Out, no helpers: 7.1 km/h. Express Delivery, no helpers: 12.9 km/h. Daily Drops every 30 days, with the assist and with the guide: 26 flights, slowest 13.8 km/h.

**Ten-Second and 1979 mode with whole-number burns.** These checks print nothing when they pass; a scratch run of the same functions (not kept in the repository) gave: the prediction-panel pilot lands on the Moon at 2.79 km/h (39 turns, 7.7% left), Mars at 4.12 (42 turns, 15.8%) and Psyche at 0.63 (196 turns, 1.2%: whole numbers are coarse where hovering takes under 1%); the searched Earth flight lands at 0.97 km/h in 35 turns with 21.8% left. The 1979 figures are in fact 25 above.

**Daily Drop, every day of 2026:** all fair; the slimmest day keeps 6.3% of the tank; all four worlds appear; the autopilot lands every seventh day.

**Fuel difficulty.**

| Setting | World | Tank | Perfect run keeps | Assist · guide · no helpers (km/h) |
|---|---|---|---|---|
| Generous | Moon | 15,158 (130%) | 28.4% | 3.1 · 2.7 · 3.1 |
| | Mars | 23,023 (130%) | 35.8% | 7.3 · 3.8 · 7.3 |
| | Psyche | 13,000 (130%) | 22.7% | 2.1 · 2.9 · 2.1 |
| | Earth | 37,252 (130%) | 27.9% | 5.4 · 13.8 · 5.4 |
| Tight | Moon | 9,375 (80%) | 7.0% | 2.2 · 4.3 · 2.2 |
| | Mars | 10,626 (60%) | 8.7% | 5.8 · 4.0 · 5.8 |
| | Psyche | 9,419 (94%) | 7.0% | 1.9 · 2.1 · 1.9 |
| | Earth | 17,193 (60%) | 11.7% | 12.5 · 12.4 · 12.5 |

Slowest mission: 13.8 km/h at Generous, 12.6 at Tight. Slowest Daily Drop (every 45 days): 13.7 and 14.0. Ten-Second, planned from the prediction panel (Moon, Mars, Psyche, Earth): 0.1, 2.9, 2.8, 4.1 at Generous; 4.4, 9.0, 1.2, 4.7 at Tight.

**Free Flight.**

- Upright, the 2D step matches `advance()` on every world, 6 touchdowns included, to 4.5 × 10⁻¹³.
- Leaning 30° in empty space, a full tank gives 3,728.5 km/h sideways and 6,457.9 up, as the rocket equation says.
- 320 km/h sideways for 10 s covers exactly 1 km. Rotation: 60°/s, 20°/s fine, stops at 75°. `U` levels from 75°, 40° and 10° in 0.60, 0.50 and 0.28 s.
- Terrain: 200 sites (50 per world) hold 821 flats and barges, every site 3–6 flats (2–4 barges at sea), 12–60 m, 4° or less; walking every site a metre at a time finds no other spot where both feet would stand.
- Touchdown rules: 7.95° stands and 8.05° tips; 9.95° of lean off the ground stands and 10.05° tips; 5.95 km/h of slide stands and 6.05 tips; a hard hit on a slope is a crater; at sea, a deck stands, the water splashes.
- Fuel budget (the perfect pilot in the budget case, from the Standard tank): final approach Moon 1,200 used (keeps 40.0%), Mars 1,834 (34.5%), Psyche 695 (44.4%), Earth 3,213 (40.5%); full descent Moon 10,557 (17.7%), Mars 13,715 (22.6%), Psyche 9,946 (17.1%), Earth 23,817 (16.9%).
- Fairness, seeds 1–1,000 per world and start: at Standard, all 8,000 fair at once; the planner's slimmest landing kept 25.9%, 30.3%, 32.3% and 29.7% (final approach: Moon, Mars, Psyche, Earth) and 11.1%, 15.6%, 14.4% and 15.4% (full descent). At Tight, the final approach re-rolled 122, 175, 44 and 251 seeds (at most 3, 4, 2 and 4 times), keeping at least 20.0%; the full descent was fair at once, slimmest 9.2%, 13.2%, 9.0% and 13.7%. Named sites: fair at every setting, with two extra starts in all.
- Human pilots on the named sites, every start and setting (ending and fuel left; g, s, t = Generous, Standard, Tight):

| Site | final/g | final/s | final/t | full/g | full/s | full/t |
|---|---|---|---|---|---|---|
| The Marbles | smooth 68% | smooth 59% | smooth 42% | butter 28% | smooth 19% | smooth 14% |
| Night Rim | smooth 67% | smooth 57% | smooth 38% | butter 29% | smooth 19% | smooth 14% |
| The Brink | smooth 55% | butter 44% | smooth 29% | smooth 32% | smooth 24% | smooth 19% |
| Blue Hour Dunes | smooth 51% | smooth 39% | smooth 23% | smooth 33% | smooth 25% | smooth 20% |
| Iron Crags | smooth 77% | smooth 71% | smooth 54% | smooth 28% | smooth 18% | smooth 13% |
| Barge Row | smooth 52% | butter 43% | smooth 34% | smooth 24% | smooth 20% | smooth 17% |

- Human pilots on random sites (the plain run's sample; on target, and the average fuel left):

| Setting · start | Moon | Mars | Psyche | Earth |
|---|---|---|---|---|
| Standard · final approach | 10/10 · 58% | 10/10 · 49% | 10/10 · 61% | 10/10 · 55% |
| Standard · full descent | 6/6 · 19% | 6/6 · 25% | 6/6 · 17% | 6/6 · 19% |
| Generous · final approach | 4/4 · 68% | 4/4 · 58% | 4/4 · 70% | 4/4 · 62% |
| Generous · full descent | 3/3 · 28% | 3/3 · 32% | 3/3 · 28% | 3/3 · 23% |
| Tight · final approach | 4/4 · 43% | 4/4 · 36% | 4/4 · 46% | 4/4 · 39% |
| Tight · full descent | 3/3 · 14% | 3/3 · 19% | 3/3 · 13% | 3/3 · 17% |

The larger `--full` run (200 or 100 sites per world and start) was not repeated on 7 October 2026; its last recorded results are in [ARCHITECTURE.md](ARCHITECTURE.md#tests).

### Simulating the original

The 1979 arithmetic was searched for the gentlest landings before the rebuild began. All four worlds can be landed at under 2 km/h:

| World | Coast turns | Turns in all | Fuel left | Burn that holds speed near the ground |
|---|---|---|---|---|
| Earth | 10 | 36–45 | 14–22% | about 28 |
| Moon | 7 | 20–24 | 16–18% | about 6 |
| Mars | 11 | 27–30 | 26–28% | about 14 |
| Asteroid Alpha | 6 | about 28 | about 11% | about 0.7 |

The best flights all follow the same pattern: coast, brake at 100 for many turns, then taper the burn down while hovering towards the ground.

## Regression checks

`scripts/check-lander.ts` exits with an error if any of these fail. Tolerances are as written in the script.

| What | Locked at |
|---|---|
| 1979 starting numbers | Earth exactly 521 km and 28,655, engine 19,869.16 ± 0.01; the asteroid exactly 175 km and 10,000 |
| 1979 no-burn oil | 10,670, 5,562, 6,773 and 5,046 km/h, ± 1, and an oil verdict |
| 1979 landings | The searched Earth flight under 2 km/h; four whole-burn flights under 5 km/h |
| 1979 quirks | The clock carries over (over 400 s after the Earth flight); −5 and 101 refused, 37.5 accepted; 19.5 km/h gives a wreck and a landing; flag at 1.9 and 5, not at 5.1; explosion at 46, not 45; oil at 5,000, crater at 4,999 |
| Integrator | Free fall and touchdown to 10⁻⁶; rocket equation to 10⁻⁵ relative; hover holds 10 km/h ± 0.02; step size changes a 300 s flight by under 10⁻⁴ km and 10⁻³ km/h |
| Full power | Stop height ± 0.2 km and the ending, per world; the simulated fall within 4% of the 1979 shortcut |
| Worlds | A perfect hoverslam keeps over 8%; the autopilot lands under 2 km/h; a no-burn flight strikes oil |
| Missions | At least 5% to spare in a perfect run; the autopilot and a slow human clear each one |
| Landing assist | The green line lands under 5 km/h on every world and allowed mission; the amber line right to 0.05% of the braking distance, and 2% lower lands over 20 |
| Human pilots | Under 20 km/h on every world with each helper style; every 30th Daily Drop with the assist and the guide |
| Ten-Second | Under 5 km/h on the Moon, Mars and Psyche with whole burns; the searched Earth flight under 2 |
| Daily Drop | Every day of 2026 keeps at least 6%; the same drop every time; all four worlds; the autopilot under 20 km/h every seventh day |
| Fuel difficulty | Under 20 km/h at Generous and Tight for every world and helper style, every mission, every 45th Daily Drop and a planned Ten-Second flight per world |
| Grades | Band edges at 2, 5, 20, 45, 100, 250 and 5,000 km/h |
| Free Flight model | Upright 2D equals 1D to 10⁻⁹ with at least 6 touchdowns; the sideways rocket equation to 10⁻⁵ relative; 1 km in 10 s at 320 km/h to 10⁻¹²; 60°/s, 20°/s and the 75° stop; levelling within 0.7 s |
| Free Flight terrain | Same seed, same ground; 3–6 flats (2–4 barges), 12–60 m, 4° or less; no hidden standing spots |
| Free Flight touchdowns | Each standing rule 0.05 either side of its limit |
| Free Flight fuel | The perfect pilot keeps at least 8% in the budget case; every seed 1–1,000 lands with 20% (final approach) or 8% (full descent) to spare, at Standard and Tight; named sites keep their ground and are fair at every setting |
| Free Flight humans | Every named site, start and setting on target; the random sample 100% on target (95% with `--full`) |

The unit tests (`npm test`) lock the rest:

| Test | Locks |
|---|---|
| `tests/unit/dailies.test.ts` | The Daily Drop for 7 October 2026: #280, Psyche, 4,200 km/h, fuel factor 1.01, 4,000 cargo. Any change to the Daily Drop's maths or numbering breaks it |
| `tests/unit/migration.test.ts` | A real pre-kit save (`tests/fixtures/lander.v1.json`) loads into version 3 with its flag, missions, best speeds, worlds, sites, keycaps and settings; every old emoji emblem becomes a drawn one; the legacy key `anykey.dontcrater.v1` is left as it was; Forget my data clears everything but the flag; forgetting the whole collection leaves nothing |
| `tests/unit/manifest.test.ts` | The fifteen achievement ids, titles and hints the game had before the kit, unique ids and known tiers |
| `tests/e2e/story.spec.ts` | Every chapter of this Story renders and every Mermaid diagram in it draws |

## Open questions

- **Level II `INPUT`.** We believe `Enter` on its own keeps a numeric variable's previous value and that text gets `?REDO`, and 1979 mode copies both. Running the listing in a TRS-80 emulator (*trs80gp* or *sdltrs*) would settle it.
- **A fractional world choice.** `ON … GOTO` on line 140 should truncate 2.5 to 2 (the Moon); 1979 mode does the same. Unchecked on the machine.
- **Real pace.** How long a turn's flame flicker, the explosion and the flag took on a 1.77 MHz Z80 decides how fast 1979 mode should play its animations. An emulator at true speed would tell.
- **Which Space Landers is ours.** The catalogue promises three skill levels that our listing lacks. Another copy of Package Four would show whether ours is earlier or later.
- **The byte behind `<16>`.** Code 16 is not a graphics character, so the converter's original byte is unknown. The screen layout needs one character there.
- **Who wrote it.** Neither the listing nor the catalogue names the programmer.
- **The `--full` Free Flight table.** It was not re-run for this chapter, and it was recorded as the least fuel left while the script now prints the average. A fresh `--full` run (well over an hour) would replace it.
