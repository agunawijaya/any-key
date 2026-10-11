# Over / Short: notes

The lab book: what we verified about the two programs behind Over / Short, how, and the simulations behind the
Classic drill, the Campaign, Field Artillery, the duel and the Daily Barrage. Line numbers are the BASIC listings'. The listings stay outside the repository;
everything here is in our own words.

## Verified facts about the originals

From reading `GUNNER.BAS` (52 lines) and `CANNON.BAS` (69 lines), unless a fact says otherwise.

1. **Credits in the listings.** Gunner's title lines name Creative Computing of Morristown, New Jersey (lines
   10–20) and no author. The Cannoneer listing prints only its title (line 10): no author, no publisher, no date.
2. **Lineage, from outside the listings.** Wikipedia's article on artillery games lists Gunner (1973) by Tom
   Kloos among the earliest. The Internet Archive's entry for Gunner reproduces the description from *BASIC
   Computer Games* (Creative Computing, 1978): Tom Kloos of the Oregon Museum of Science and Industry in Portland
   wrote it, and David Ahl later modified it extensively. See open questions for what we could not confirm.
3. **One program, twice.** Cannoneer follows Gunner's logic line for line: the same variables (R, T, B, E, S, S1,
   Z), the same order of tests, the same ending. It changes the units (metres instead of yards), the range of the
   gun, every message, adds PC-speaker sound and accepts a lower-case answer to "play again". `SOUND` with
   durations counted in clock ticks marks it as written for IBM PC BASIC.
4. **The gun.** Gunner rolls its greatest range as INT(40000 × RND + 20000), 20,000 to 59,999 yards (line 170).
   Cannoneer rolls INT(4000 × RND + 10000), 10,000 to 13,999 metres (line 100). One gun serves all five targets;
   a new one is rolled only when you play again (Gunner 510 → 170, Cannoneer 660 → 100).
5. **Targets.** Each target is INT(R × (0.1 + 0.8 × RND)) away: from 10% to just under 90% of the greatest range
   (Gunner 200, Cannoneer 150). Both programs tell you R and T.
6. **The physics.** A round fired at B degrees comes down at R × SIN(2 × B / 57.3) (Gunner 450, Cannoneer 550):
   the range of a projectile in a vacuum over level ground, with 57.3 standing in for 180/π (57.2958). On the
   longest Gunner range that approximation moves a round at most 13.7 yards. There is no air, wind or height,
   so θ and 90° − θ land on the same spot.
7. **The perfect first shot.** The elevation prompt takes any number, fractions included (Gunner 400, Cannoneer
   410), so a player who knows the formula types ½ · asin(T ÷ R) and hits with every first round: 5 rounds a game,
   in our simulation of 1,000 games of each program.
8. **What counts as a hit.** The error is E = INT(T − I), and |E| < 100 is a hit (Gunner 460, Cannoneer 560).
   INT rounds towards minus infinity, so the window is lopsided by a yard: a round anywhere up to 100 short is a
   hit, but one more than 99 over is a miss (the check finds 98.55 short a hit and 99.45 over a miss).
9. **The over/short bug.** A miss is called short only when E > 100 (Gunner 470, Cannoneer 570). When E is
   exactly 100, a round between 100 and 101 units short, the observer reports it **over** by 100.
10. **Elevations out of bounds.** Above 89 or below 1 the program objects and asks again (Gunner 420–430 with
    230–260, Cannoneer 420–430 with 180–210). The round counter only goes up after these tests (Gunner 440,
    Cannoneer 490), so a refused elevation costs nothing. Exactly 1 and exactly 89 are accepted.
11. **Five rounds a target.** S counts the rounds at the current target. On the sixth elevation, before that
    round is judged, the enemy destroys your gun (Gunner 442–446, Cannoneer 500–540). In Cannoneer the firing
    sounds come first (440–480), so the fatal sixth round is heard leaving the barrel.
12. **The 18-round standard.** After the fifth target (Z counts 0 to 4) the total S1 is printed; more than 18
    earns the line about refresher training at Fort Sill, 18 or fewer the praise (Gunner 490–495, Cannoneer
    590–640). Being destroyed jumps to the Fort Sill line without a total (Gunner 446 → 495, Cannoneer 540 → 630).
13. **Play again.** Gunner restarts only on a capital Y (510); Cannoneer takes Y or y (660).
14. **Cannoneer's sounds.** Line 90 sets 18.2 clock ticks to the second, because `SOUND` measures time in ticks.
    Every round fired plays a 400 Hz tone for half a second (440), a whistle climbing from 3,000 to 4,000 Hz in
    101 steps of about 20 ms, two seconds in all (450–470), and a 150 Hz thud for half a second (480). A destroyed
    target gets five quick sweeps from 500 to 3,500 Hz (310–350). Your own destruction is a 100 Hz drone of ten
    ticks, just over half a second (520).
15. **The same war every time.** Neither program calls `RANDOMIZE`, so under Microsoft BASIC a freshly loaded
    program rolls the same gun and the same targets every run. (Cannoneer's `RND(6)` is just the next random
    number: any positive argument does that in IBM PC BASIC.)
16. **Message slips.** Cannoneer's messages carry two spelling mistakes. Nothing of either program's text is in
    our game.
17. **The war a fresh load fights.** Run unmodified in PC-BASIC 2.0.8 (a GW-BASIC interpreter), a freshly loaded
    Gunner rolls a gun of 24,854 yards and a first target 15,446 yards away; a freshly loaded Cannoneer, a gun of
    10,485 metres and a first target 6,516 metres away. Playing again rolls the next gun in the same sequence
    (Cannoneer's second war: 12,919 metres).
18. **Typing that is not a number.** At the elevation prompt, letters get the interpreter's own request to type
    the line again, not the program's; an empty line counts as 0 and is refused as too low.

### How these were checked

Facts 1, 3–16 come from reading the listings. `lib/over-short/original.ts` reproduces the rules (the dice, the
judge with 57.3, INT and the > 100 test, the sixth-round ending), and `scripts/check-over-short.ts` pins facts
4–5 (100,000 rolls each), 6, 8–11 against it. Fact 2 comes from the two web sources named in it. Fact 14's
timings are worked out from the code and IBM PC BASIC's tick rate, not heard.

Facts 9–13, 15, 17 and 18 were also seen to happen: both listings were run unmodified in PC-BASIC 2.0.8 for six
scripted sessions ([the 1970s terminals](#the-1970s-terminals)), and the terminals replay the same sessions step
for step.

## Quirks and bugs, and what Over / Short does with them

| Quirk | In 1973 | In Over / Short |
|---|---|---|
| A round 100 short is called over (9) | Yes | Fixed in every play style: the observer calls the direction the round fell. The 1970s terminals keep it |
| Lopsided hit window from INT (8) | Yes | A hit is any round within 100 m either way, measured exactly. The terminals keep the lopsided window |
| 57.3 for 180/π (6) | Yes | Exact radians; Classic and the 1973 judge disagree on 2 calls in 20,000, all within 4 m of the 100 m edge. The terminals divide by 57.3 |
| The sixth elevation is never fired (11) | Yes | The fifth miss at one target ends the game at once: the enemy has found the gun. The terminals ask for the sixth elevation, as the programs did |
| The formula gives a first-round hit every time (7) | Yes | Kept in Classic and on the terminals, where it belongs. The Campaign exists to break it, one twist per chapter; Field Artillery has no formula at all |
| Same gun and targets every load (15) | Under Microsoft BASIC | Every game has its own seed. The terminals run Microsoft BASIC's own generator from its state at load, so they fight the same war every time, as the programs did |
| Yards from 20,000 to 59,999 (4) | Gunner | Classic uses Cannoneer's metric scale (see the simulations for why); yards are a display setting |

## Simulations

All numbers come from `npx tsx scripts/check-over-short.ts` (seeded, so they repeat exactly).

### Players at the drill

Five players, 1,000 games each, under Gunner's rules, Cannoneer's rules and our Classic. Each player sees only what
the screen shows: the greatest range, the distance, and the observer's calls.

- **calculator** knows the formula: ½ · asin(T ÷ R).
- **reader** keeps every round as a row of their own range table (elevation → where it landed) and interpolates
  between the two rows nearest the target; it is the "sensible gunner" of the Campaign checks.
- **halving** is the old gunner's rule with distances: the first correction from the reported miss and a rule of
  thumb (the greatest range spread over 45°), then the correction is halved every time the call flips.
- **bracketer** uses only "over" and "short": steps 4° until bracketed, then splits the difference.
- **naive** moves one degree after every report.

All but the calculator start from the same rule of thumb: elevation in proportion to distance, 45° for the
greatest range.

| Rules | Player | All five targets | 18 rounds or fewer | Rounds per target destroyed |
|---|---|---|---|---|
| Gunner (yards) | calculator | 100.0% | 100.0% | 1.00 |
| | reader | 99.2% | 99.2% | 2.16 |
| | halving | 0.0% | 0.0% | 3.96 |
| | bracketer | 0.0% | 0.0% | 4.14 |
| | naive | 0.0% | 0.0% | 4.07 |
| Cannoneer (metres) | calculator | 100.0% | 100.0% | 1.00 |
| | reader | 99.6% | 99.6% | 1.85 |
| | halving | 1.3% | 0.2% | 4.09 |
| | bracketer | 1.1% | 0.1% | 3.93 |
| | naive | 0.0% | 0.0% | 4.08 |
| Classic (ours) | calculator | 100.0% | 100.0% | 1.00 |
| | reader | 100.0% | 100.0% | 1.81 |
| | halving | 1.7% | 0.2% | 4.14 |
| | bracketer | 2.1% | 1.0% | 3.91 |
| | naive | 0.0% | 0.0% | 3.91 |

What this says about the 1973 drill:

- **Five rounds are not enough to bracket.** The hit window is tiny in degrees. A change of elevation of one
  degree moves the fall of shot by 2R · cos 2θ · π/180: on a 60,000-yard Gunner gun, about 1,800 yards per degree
  at 15°. So the 200-yard window is about a tenth of a degree, and halving from a few degrees away needs six or
  seven rounds. Even on Cannoneer's 12,000-metre gun the window is about half a degree.
- **The distance in the report is the whole game.** A player who uses it, the way a battery officer reads a
  range table, meets the standard almost every time; one who uses only the direction almost never does.
- **The yard scale is harsher.** The reader needs 2.16 rounds a target on Gunner's guns and 1.85 on Cannoneer's;
  Classic uses Cannoneer's scale, where a careful player with tenths of a degree can always find the target.

### The models

| Check | Result |
|---|---|
| Vacuum model against R · sin 2θ, 1°–89°, three guns | worst error 0.000 m (RK4 is exact for constant gravity; the landing is solved within the last step) |
| Complementary angles in a vacuum | apart by at most 0.000 m |
| Air, 12,500 m vacuum gun, drag 4 × 10⁻⁵ per metre | best range 9,178 m at 42.61°; 30° lands 626 m beyond 60° |
| Air, the battery's 14,000 m gun (Chapters 4–5) | best range 9,983 m at 42.38°; 30° lands 738 m beyond 60° |
| Air, 15,500 m vacuum gun | best range 10,747 m at 42.17°; 30° lands 852 m beyond 60° |
| Classic's observer against the 1973 judge, 20,000 random rounds | 2 calls differ, all within 4 m of the 100 m edge |

The drag constant was chosen for play, not taken from a real shell: it costs the gun a quarter of its vacuum range
and moves the best angle about three degrees below 45°, enough to feel, small enough to reason about. In the
modified model (Chapter 3) wind pushes the shell with 0.04 m/s² per m/s of wind, so a 12 m/s wind moves a 20°
round about 140 m and a 60° round about 880 m: the longer the flight, the more the wind takes.

### The Campaign

The sensible gunner (the reader above) plays every mission 300 times, each with its own seed. It sees the
briefing, the distance, the reports and how long each round flew; it leads a moving target by its speed times the
time of flight; it moves the gun when the enemy's rounds land within 300 m. Chapter 1's missions are also played by
the pure bracketer, since there the observer gives only directions.

| Mission | Won | Rounds (median, worst, ammunition) | Gold · silver · bronze |
|---|---|---|---|
| 1-1 First Light | 100% (bracketer 100%) | 5, 7, 10 | 30.7% · 65.0% · 4.3% |
| 1-2 The Long Field | 100% (100%) | 6, 6, 10 | 1.3% · 98.7% · 0% |
| 1-3 Close Work | 100% (100%) | 4, 5, 10 | 39.0% · 61.0% · 0% |
| 1-4 Two Roads | 100% (100%) | 7, 8, 12 | 19.0% · 78.7% · 2.3% |
| 2-1 New Gun | 100% | 4, 5, 6 | 0% · 81.0% · 19.0% |
| 2-2 Captured Piece | 100% | 4, 5, 6 | 1.0% · 74.0% · 25.0% |
| 2-3 Worn Barrel | 100% | 3, 4, 5 | 15.3% · 78.0% · 6.7% |
| 2-4 One Gun, Two Targets | 100% | 6, 7, 8 | 7.3% · 92.3% · 0.3% |
| 3-1 Up the Ridge | 100% | 3, 4, 6 | 28.7% · 71.3% · 0% |
| 3-2 Into the Valley | 100% | 4, 4, 6 | 0% · 100% · 0% |
| 3-3 Headwind | 100% | 4, 4, 6 | 0% · 100% · 0% |
| 3-4 Ridge and Gale | 100% | 3, 4, 5 | 35.3% · 52.0% · 12.7% |
| 4-1 Thick Air | 100% | 4, 4, 6 | 0% · 100% · 0% |
| 4-2 Not Forty-Five | 100% | 3, 5, 7 | 0% · 52.7% · 47.3% |
| 4-3 The High Road | 100% | 3, 4, 6 | 0% · 100% · 0% |
| 4-4 Table Maker | 100% | 7, 8, 10 | 0% · 95.0% · 5.0% |
| 5-1 Convoy | 100% | 4, 4, 7 | 32.0% · 68.0% · 0% |
| 5-2 Last Shells | 100% | 2, 3, 3 | 32.0% · 65.0% · 3.0% |
| 5-3 Against the Clock | 100% | 3, 3, 8 | 41.3% · 58.7% · 0% |
| 5-4 Counter-Battery | 100%, moving the gun every time | 4, 4, 9 | 0% · 100% · 0% |

Medals are set so the sensible gunner mostly earns silver: gold asks for a player who brings something more (the
formula, the complementary angle, a good first guess from the table). A player who reaches gold everywhere has
earned Fort Sill Graduate.

**Each twist matters.** The same gunner, blind to one thing:

| Mission | Blind to | Won |
|---|---|---|
| 5-1 Convoy | the convoy's speed (aims where it is, not where it will be) | 45.7% |
| 5-3 Against the Clock | the clock (takes the slow high road) | 0% |
| 5-4 Counter-Battery | the enemy (never moves the gun) | 0% |

From Chapter 4 the battery keeps one gun (14,000 m in a vacuum, 9,980 m in air), so the range table a player
builds stays true from mission to mission. The clock mission comes with a short range table (15°, 25°, 35°) and
200 seconds: enough for the low road, where a round flies 20 to 35 seconds, and not for the high road, where it
flies more than a minute.

The convoy drives at 8–11 m/s: at 5 m/s, the first design, a low round's 15–20 s of flight moved it less than the
hit radius and leading did not matter (the blind gunner still won 99.7%). The first enemy battery took five
rounds to find the gun, so a gunner who never moved still won every time; now its third round is lethal.

## Field Artillery

### The model

Field Artillery flies every round in three dimensions (`lib/over-short/fieldModel.ts`): the same fourth-order
Runge–Kutta step of 0.1 s and the same drag as the Campaign's air (k = 4 × 10⁻⁵ per metre, against the velocity
through the air), with wind along and across the line of fire, over real ground (`terrain.ts`: a smooth survey
line with a little unevenness). The ground crossing is found by bisection inside the last step; a round that meets
the ground while still climbing is marked as having struck a crest.

The gun has four charges, muzzle speeds of 190, 245, 300 and 370 m/s, which throw at most about 3.3, 5.2, 7.2 and
9.9 km in still air. The line is in NATO mils, 6,400 to the circle; the muzzle stands 1.2 m above the ground.

| Check | Result |
|---|---|
| No air, no wind, level ground, at 10°, 30°, 45° and 60° | lands where R · sin 2θ says, within 5 cm |
| Air, against the Campaign's model at the same four elevations | the same landing, within 5 cm |
| Crosswind drift against Didion's lag rule (drift = wind × the shell's lag behind a vacuum flight over the same distance), 4 charges × 4 elevations, 6 m/s across | worst difference 0.0% |
| Charge 3 at 30° | 6,539 m in still air; 6,576 m with a 5 m/s tailwind, 6,501 m into a 5 m/s headwind; 19.1 m of drift either way in 5 m/s across |
| The firing table's wind columns against a flight, charge 2 at 30° in 4 m/s behind and across | table 4,650 m and 9.2 m right; flight 4,644 m and 9.0 m |
| Charge 4 at 6° at a ridge 150 m high | struck the rising ground 578 m out, still climbing |

### Why the first round rarely hits

The first version of the skilled-gunner bot hit with its first round almost every time: with the table, the
forecast and the map all exact, the physics can be solved. Real batteries missed with the first round because none
of those is exact, so each attempt now draws these errors, and the target card and the forecast show what the
battery believes, not the truth:

| Source | Easy | Normal | Hard |
|---|---|---|---|
| The map's error in the target's position (along, across) | up to 70 m, 20 m | up to 160 m, 45 m | up to 260 m, 80 m |
| The forecast's error in each wind component | up to 0.5 m/s | up to 1.5 m/s | up to 2.5 m/s |
| This barrel against its table (wear), share of muzzle speed | up to 1.2% either way | the same | the same |
| One round's powder against the next (dispersion) | 0.15% | 0.25% | 0.35% |
| Gusts: each round's wind against the mean | 6% | 15% | 28% |
| The observer's misjudgement, and the rounding | none, 10 m | about 8%, 25 m | about 15%, 50 m |

The first round's report measures the map, forecast and wear errors together, and they carry over to every round on
that target: that is why registering a charge pays, and why switching charge costs a little accuracy as well as 15
seconds.

### The players

The checks play every shoot with three simulated players. Two see only what the screen shows (`fieldSeen`: the
map's distance, the height, the forecast, the firing tables and the observer's words):

- **the skilled gunner** (`fieldGunnerBot`) keeps a registration: how much further than the table its rounds have
  been throwing, shared across charges, and how far right they have been drifting. It picks the charge and
  elevation whose path clears any crest with room to spare, prefers the middle of the table and a charge already
  registered, leads a convoy by the flight time, calls star shells, and moves the gun when the enemy's next round
  would land close;
- **a player at the screen** (`fieldHumanBot`) lays the first round straight from the table at the map's distance,
  then takes each correction at its word but only partly trusts it, and brackets the flashes at night in steps
  that halve when the call flips;
- **the oracle** (`fieldOracle`) knows the target's true position, the true mean wind and this barrel's wear, but
  not the gusts. If the oracle ever loses an attempt, the attempt was dealt unwinnable.

### The shoots

60 attempts per shoot and difficulty for the gunner and the player, 30 for the oracle, each with its own seed:

| Shoot | Gunner: Easy, Normal, Hard | Player at the screen, Normal | Player's median rounds and game time | Gold, silver |
|---|---|---|---|---|
| F1 Registration | 100%, 100%, 100% | 100% | 2, 72 s | 2 in 1:20, 3 in 2:20 |
| F2 Behind the Crest | 100%, 98.3%, 98.3% | 98.3% | 2, 93 s | 2 in 1:50, 4 in 3:10 |
| F3 Crosswind | 100%, 100%, 100% | 100% | 3, 114 s | 2 in 1:30, 3 in 2:20 |
| F4 The Supply Road | 100%, 100%, 100% | 96.7% | 3, 87 s | 2 in 1:05, 3 in 1:50 |
| F5 Smoke | 100%, 100%, 100% | 100% | 2, 79 s | 2 in 1:40, 4 in 3:30 |
| F6 Counter-Battery | 100%, 100%, 100% | 100% | 3, 262 s | 2 in 2:00, 4 in 5:40 |
| F7 Drop the Bridge | 100%, 100%, 96.7% | 98.3% | 5, 209 s | 4 in 3:00, 5 in 4:20 |
| F8 Night Shoot | 100%, 100%, 100% | 100% | 3, 138 s | 2 in 1:50, 3 in 3:20 |
| F9 Bridge by Night | 100%, 100%, 96.7% | 93.3% | 4, 207 s | 4 in 3:35, 6 in 5:00 |
| F10 Under Fire | 100%, 100%, 100% | 100% | 3, 116 s | 3 in 2:00, 4 in 3:20 |

The oracle won every attempt at every shoot on every difficulty. Medals are set from the player at the screen: the
median player earns silver or bronze, and gold asks for a first round laid from a good registration.

**Each twist matters**, played on Normal by the player at the screen, blind to one thing:

| Shoot | Blind to | Result |
|---|---|---|
| F2 Behind the Crest | the crest (lays the flattest path) | won 80.0%, against 98.3% seeing it |
| F4 The Supply Road | the convoy's movement | won 0% |
| F3 Crosswind | the crosswind (lays on the bearing) | 2.53 rounds a win against 2.45; still wins every time |
| F9 Bridge by Night | star shells (never calls one) | won 81.7% against 93.3%, 5.49 rounds a win against 4.59 |

The crosswind costs little once the first round has fallen, because the observer's left and right correct it at
once; what it costs is the first round, which is what the medals reward.

Tuning on the way: F2 first set its target further out behind a higher crest, which left a player at the screen
too few charges that clear it; the target is now 2.2–2.7 km out behind a crest 130–160 m high. F4's convoy first
drove faster and closer to the crossing; it now drives at 4–6 m/s across the line and starts a minute short of the
crossing, with a 30 m hit radius.

### The duel

120 duels for each commander and player, each side played from both ends of the ridge, on Normal:

| Player | Beats cautious | Beats aggressive | Beats methodical |
|---|---|---|---|
| a player at the screen (`fieldHumanBot`) | 53.3% | 56.7% | 38.3% |
| the skilled gunner | 74.2% | 82.5% | 69.2% |

Every duel ended. The commanders are the player-at-the-screen bot with their own settings: cautious takes 60% of
each correction and moves when a round lands within 230 m; aggressive takes 115%, never moves and loads the charge
with the shortest flight; methodical takes 85% and moves within 120 m. On the way, the aggressive commander first
won most duels and was retuned; each shot now keeps where its own side's map put the enemy when it was fired, so a
battery that moves does not confuse the other side's earlier corrections; and duels that ran out of rounds without
a winner are settled by 20 rounds a side and the fewer-hits rule.

### The Daily Barrage

The first 120 days: the oracle won every one, the skilled gunner 100%. Each run of ten days counted from the first
Daily plays all ten shoots in an order of its own, and on about a third of the days whose shoot has no enemy, a
battery 3–4 km beyond the target joins in.

## The 1970s terminals

`lib/over-short/terminal.ts` plays each program as a state machine in Microsoft BASIC's arithmetic: single
precision (`Math.fround` on every value) and its random generator, a 24-bit linear congruential sequence (each
state is 214,013 × the last + 2,531,011, modulo 2²⁴) starting from the state it has when a program is freshly
loaded. Everything they print is written fresh.

The golden sessions in `tests/fixtures/over-short-1970s.json` were made by running both listings unmodified in
PC-BASIC 2.0.8 with lines typed at their prompts, keeping only what happened, as kinds and numbers (a gun, a target,
a refusal, over or short by so much, a target destroyed in so many rounds, the gun found, the total, play again):
none of the programs' words.

| Sessions | Typed | What they show |
|---|---|---|
| gunner-calculator, cannoneer-calculator | the formula's elevation, to four places, for each target | five targets in five rounds |
| gunner-quirks, cannoneer-quirks | letters, an empty line, 0, 90, −5, 89, 1, fractions, an elevation that falls 100 short, six rounds at one target, a lower-case y | not-a-number, four refusals with nothing counted, the round 100 short called over, the sixth round never fired, Gunner refusing y and Cannoneer accepting it; Cannoneer then plays a second war to a total of 19 (the artillery school) and a third of 5 |
| gunner-slow, cannoneer-slow | three misses and then the formula at each target, a capital Y, then six misses at one target | a total of 20 (the artillery school), playing again, and the gun lost |

The check replays each session on the terminal and compares every event: all six match, 184 events in all.

## Drawing performance

Measured with Playwright's Chromium at 1920 × 1080, on a real graphics card and on the software renderer, in the
first round of F6 in the dark theme (the night barrage, the heaviest scene), F7 by day and the duel:

| Scene | Graphics card | Software renderer |
|---|---|---|
| Aiming | 60 fps | 35 fps |
| A round in flight and its burst | 60 fps, worst frame 17 ms | 32 fps |
| The glasses and the enemy's rounds | 60 fps, worst frame 17 ms | 26 fps |
| The duel, both guns firing | 60 fps, worst frame 17 ms | 38 fps |

Three things got it there:

- **Tiles kept per scale.** The close view under fire first zoomed in smoothly, so every frame was a new scale and
  every tile was repainted: 5 fps. The close view is now a cut, and the side view keeps its tiles per scale.
- **Painting ahead.** While the player aims, the side view paints one tile a frame of the close view and of the
  land out past the target (`SideView.prepare`, `warmOne`). Before, a profile showed the camera riding the shell
  into unpainted land, and the cut to the close view painting 36 tiles in one frame (183 ms).
- **A resize that changes nothing repaints nothing.** Layout reported the same size twice after the screen opened,
  which threw away every tile and the queue of tiles to paint ahead. The side view now ignores a resize to its own
  size, and counts the times it has dropped its tiles (`generation`), so the director knows to prepare them again.

The audio is opened when the Field Artillery or duel screen opens, not on the first shot: creating the audio
context took 80 ms in the profile, and the first round's frame paid for it. One frame of about 120 ms remains at a
session's first shot, outside JavaScript (in the graphics process); it does not repeat.

## Hero frames

`docs/over-short/media/hero/`, each in light and dark, 1920 × 1080:

| File | What it shows | Made in |
|---|---|---|
| `arc-*.jpg` | the camera riding a shell along its arc over the fields | 07a |
| `dump-*.jpg` | a supply dump going up on the main screen | 07a |
| `observer-*.jpg` | the fall of shot in the observer's glasses | 07a |
| `walking-*.jpg` | enemy rounds walking in on the gun, one bursting beside the pit | 07b |
| `duel-*.jpg` | the duel's ridge with both guns firing at once | 07b |
| `night-*.jpg` | a night shoot under star shells (the moon up in the light theme) | 07b |

They are the game's own drawing code, staged for the camera at each prompt's first stage and saved as JPEG for
the docs; 07b's staging page was removed once the frames were approved.

## Regression checks

`npm run check:over-short` (`scripts/check-over-short.ts`) fails if:

- a fact above stops holding against `original.ts` (the over/short bug, the lopsided window, refusals, the dice,
  the sixth round);
- a player's share of complete games or of the 18-round standard leaves its band (calculator exactly 100%; reader
  97–100%; halving and bracketer at most 5% and 3%; naive at most 1%);
- the vacuum model strays 0.5 m from the formula, or complementary angles land 0.5 m apart in a vacuum;
- drag fails to bring the best angle below 44°, or 30° and 60° land within 300 m of each other in air;
- Classic's observer and the 1973 judge disagree more than 4 m from the 100 m edge;
- the sensible gunner loses any of 300 attempts at any mission, or the bracketer any Chapter 1 attempt;
- a gunner blind to a Chapter 5 twist wins more than 85% (convoy), 20% (clock) or 90% (counter-battery);
- Field Artillery's model leaves the 1973 formula or the Campaign's model by 5 cm, crosswind drift leaves the lag
  rule by 3%, a tailwind fails to lengthen or a headwind to shorten, crosswinds from either side differ, the firing
  table's wind columns miss a flight in that wind by 25 m in range or 2 m in drift, or a flat round fails to strike
  a ridge;
- the oracle loses any attempt at any shoot on any difficulty, or any of the first 120 Daily Barrages;
- on Normal the skilled gunner wins less than 90% of a shoot, or the player at the screen less than 70%;
- a player blind to the crest wins more than 90% of F2, or one who does not lead the convoy more than 30% of F4;
  ignoring the crosswind on F3 or never lighting F9 costs nothing;
- a duel never ends, or the player at the screen beats a commander less than 30% or more than 75% of the time, or
  the skilled gunner less than 55% or more than 95%;
- the skilled gunner wins less than 90% of the Daily Barrages;
- a 1970s terminal departs from a golden session in any event.

## Open questions

- **101 BASIC Computer Games.** Wikipedia dates Gunner to 1973, the year of DEC's *101 BASIC Computer Games*, and
  the 1978 *BASIC Computer Games* credits Tom Kloos. We could not see a scan of the 1973 book's contents to
  confirm Gunner (or a six-letter GUNER) was in it.
- **Cannoneer.** We found nothing about it beyond the listing: not its author, date or where it was published.
- **The 1973 machines.** Whether Gunner's targets repeated on the minicomputers it was first written for depends
  on their BASIC's RND; we only know that Microsoft BASIC repeats without `RANDOMIZE`. The Gunner terminal uses
  Microsoft BASIC's sequence, the one we could run.
- **Real charges.** The four charges are our own, chosen so each covers a band of distances with some overlap
  (3.3, 5.2, 7.2 and 9.9 km); they are not taken from a particular Great War gun's tables.
