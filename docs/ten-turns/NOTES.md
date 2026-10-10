# Ten Turns in the Pit: notes

The lab book: what we checked about the 1970s program, what its bugs do to the game, and the simulations behind
Classic, Tactics and the Daily Pit. Every number here is locked by `scripts/check-ten-turns.ts`.

## Verified facts about the original

Our copy is `RABBIT.BAS`, a tokenized GW-BASIC file of 82 numbered lines and 2,304 bytes: a PC version that clears
the screen and seeds the random numbers from the clock. We turned it back into text with
`scripts/detokenize-gwbasic.ts`, kept the listing outside the repo, and read it line by line.

1. **The pit** is a circle of radius 10 around (0, 0). The rabbit starts on whole-number coordinates from -10 to 10
   each way, drawn again until it is inside the circle (lines 41 to 46), so every one of the 317 whole-number points
   in the pit is equally likely.
2. **The drop.** The player types any two numbers, whole or not, for where to be dropped, and is asked again if the
   point is outside the pit (lines 50 to 60). Landing exactly on the rabbit squashes it and ends the game at once
   (lines 65 to 69). A blind drop has a 1 in 317 chance.
3. **Ten turns** (line 70). Each turn the program reports the rabbit's position and distance, then asks for an angle.
4. **Running.** Any multiple of 45 degrees is accepted, including 360, 405 and negative ones (line 110). The step is
   1, or the square root of two on the diagonals (lines 112 and 113), worked out with sine and cosine and a pi of
   3.14159 (lines 120 and 121). A run that would end outside the pit is refused and the angle is asked again
   (lines 125 and 126). The new position is rounded to whole numbers (lines 132 and 133).
5. **Running into the rabbit** (stepping onto its cell) is fatal (lines 136 to 138).
6. **The pounce** (lines 150 to 271). The rabbit works out the angle to the player: the angle off the x axis is cut
   to whole degrees, then put in its quarter of the circle, then rounded to the nearest 45 degrees. It moves 1 along
   the axes and 1.5 on the diagonals, rounded to whole numbers, so a diagonal pounce lands one cell across and one
   up, like a chess king.
7. **Chained pounces** (lines 140, 315 to 322). After a pounce that misses, the rabbit pounces again when a random
   whole number from 1 to P1 comes up 1; P1 starts at 2 and grows by one each pounce. So the chances are 1 in 2,
   then 1 in 3, then 1 in 4: a second pounce half the time, a third one time in six, a fourth one time in 24, and
   e - 1 = 1.718 pounces a turn on average. Measured over 200,000 turns: 50.2 %, 16.9 %, 4.2 %, 1.724.
8. **A landing is noticed late.** When a pounce lands on the player the chain stops (line 315), but the crunch is
   only declared at the start of the next turn (line 90).
9. **Source.** The title lines name Creative Computing, Morristown, New Jersey, and no author. The program is in
   David Ahl's *More BASIC Computer Games* (Creative Computing, 1979); the program notes reproduced on the Internet
   Archive say it was conceived and written by Philip Stanway. We could not open the book's page itself to confirm
   the credit (see Open questions).
10. **The random seed.** Line 40 re-seeds from the clock's seconds on every retry of the rabbit's start. In GW-BASIC
    a reseed keeps the lowest byte of the generator's state (as PC-BASIC, a faithful emulation, implements it), so a
    retry within the same second still draws a new point: the program does not hang there.

## Quirks and bugs

| Quirk | What happens | Where | In our game |
|---|---|---|---|
| **The middle-row pull** | Line 131 works out the new y from `INT(Y1+1000)/1000`: the `+` should be `*`. Whatever y was, this is about 1, so after every run the player's y is 0 (ran south), 1 (east or west) or 2 (ran north). The player is dragged back to the middle rows every turn. | 131 | Kept in the 1970s mode; fixed everywhere else |
| **Past the wall** | The wall check (line 125) looks at where the player would be before the pull moves them. So the pull can carry a player outside the pit: from (-9, -1), running north-west lands on (-10, 2). | 125 to 133 | Kept in the 1970s mode |
| **The frozen rabbit** | With the player straight north of it (same x, y above), the program sets the angle to 90 and jumps straight past the move (line 281 goes to 315). The rabbit stays put, though it still rolls for more pounces. | 281 | Kept in the 1970s mode |
| **The last-turn loophole** | Because a landing is only checked when the next turn starts, a landing in turn ten is never checked: the loop ends and the player is released with the rabbit sitting on them. | 315, 323 | Kept in the 1970s mode |
| **The rabbit leaves the pit** | Nothing keeps the rabbit inside the circle. Chasing a player along the wall it can step out: from (0, 10) towards (3, 9) it lands on (1, 10). | 270, 271 | Kept in the 1970s mode; in our pit it bonks off the wall |
| **Angles cut before rounding** | The pounce angle is cut to whole degrees before it is rounded to 45, so the boundary between straight and diagonal sits at 23 degrees, not 22.5: a player at 22.6 degrees still gets a straight pounce. | 160, 250 | Kept in the 1970s mode |
| **B = 1 for east** | Due east, the program writes the angle as 1, not 0; rounding to 45 turns it back into 0. Harmless. | 301 | Kept |
| **A spare array** | Line 103 stores a space in `A$(RP,RP1)` and `A$(HP,HP1)`; all four indexes are always 0 and the array is never read. It quietly creates an 11 by 11 string array. | 103 | Left out |
| **Rough pi** | 3.14159 leaves tiny remainders (the cosine of "90 degrees" is 0.0000013); the rounding hides them. | 120, 260 | Kept in the 1970s mode |
| **Unreachable branch** | The `ON ... GOTO` jumps on lines 170 to 190 have a middle target (back to line 10) that only a zero sign could reach, and zeros are handled earlier. | 170 to 190 | Not needed |

## Simulations

All runs are seeded with the kit's `createRng`; "best play" is exact (the solver in `lib/ten-turns/solver.ts`
works backwards from turn ten over every position), the other players are simulated (12,000 games each).

### The 1970s game, as written and with its quirks fixed

The rabbit starts anywhere in the pit; the best player drops on the best cell, the others on the middle (runner)
or anywhere (random). "Runs away" means: always the angle pointing most directly away from the rabbit.

| Rules | Picks at random | Runs straight away | Best play |
|---|---|---|---|
| As written | 5.1 % | 33.4 % | 86.9 % |
| Line 131 fixed (the rest as written) | 8.5 % | 50.5 % | 96.2 % |
| All quirks fixed | 2.4 % | 24.1 % | 33.7 % |

**What the line 131 bug does.** It makes the game harder for every kind of player: a runner survives a third of the
time instead of half, because every run drags them back towards the middle, where the rabbit usually is, and they
can never put north-south distance between them. **Best play as written is high only because of the frozen rabbit**:
the best player gets straight north of the rabbit and keeps running north (the pull keeps them on row 2, x
unchanged), and the rabbit never moves. With the line fixed that trick is easier still (96 %). With every quirk
fixed the game is brutal: even perfect play survives a blind drop only a third of the time, and from three steps
away it is all but lost (2.9 %).

**What each quirk is worth to best play** (exact, one switch at a time):

| Rules | Best play |
|---|---|
| As written | 86.9 % |
| The last-turn loophole closed | 86.2 % |
| The frozen rabbit fixed | 26.7 % |
| Line 131 fixed | 96.2 % |
| Only the loophole left | 42.2 % |
| All quirks fixed | 33.7 % |

The loophole is worth little in the program as written, where the frozen rabbit already does the work, but on its
own it lifts perfect play from 33.7 % to 42.2 %: a landing in turn ten is always forgiven.

### Classic: a fair start

Classic plays the fixed rules. Because the blind drop could put the rabbit next to the player, where even perfect
play has no chance, Classic decides where the rabbit was only after the drop: on the player one time in 317 (the
squish, as in the original), otherwise anywhere the best possible play still survives at least 40 % of the time.
Measured: every drop leaves at least 75 fair cells; the worst fair start is 40.2 %; best play averages 57.6 % over
all drops (55.7 % from the middle, matched by playing the real rules with the solver's moves: 54.6 % in 8,000 games).

### Tactics

The Tactics solver (`lib/ten-turns/tacticsSolver.ts`) is exact for plain steps against one rabbit, with the hat and
the dazed state; it is checked against the engine (`lib/ten-turns/tactics.ts`) at 500 random positions in five pits
(largest gap 9 in a million, from 32-bit storage). The policy (`lib/ten-turns/tacticsPolicy.ts`) adds tools,
burrows and carrots by looking one turn ahead over every way the rabbits' pounces can go, with their exact chances.

Two rules came out of these simulations:

- **Dazed after a bonk.** At first a rock stopped a pounce dead every time, and the solver found a way to hide
  behind one rock for the whole game (100 % survival). Now a rabbit that bonks steps round obstacles on its next
  turn, so one rock buys one turn.
- **Burrows cave in.** At first burrows could be reused, and the solver found a tunnel ping-pong that was never
  caught. Now a burrow (and a tunnel's far end) caves in behind you.

Rabbit starts were then tuned pit by pit (the solver rates every start in a pit at once), so each chapter's pits fall
in a band of policy survival. Results, 200 games per pit (`npx tsx scripts/check-ten-turns.ts`):

| Chapter | Pit | Survived | Untouched (hat kept) | Tools to spare |
|---|---|---|---|---|
| 1 | First Drop | 90.5 % | 68 % | 90 % |
| 1 | Read the Arrow | 99 % | 90 % | 86 % |
| 1 | Hat Trick | 96 % | 86 % | 84 % |
| 1 | Ring of Stones | 99.5 % | 93 % | 99.5 % |
| 2 | Rabbit Holes | 91 % | 50 % | 50 % |
| 2 | Down and Across | 94 % | 76 % | 42 % |
| 2 | Warren | 96 % | 94 % | 95.5 % |
| 2 | Last Hole | 89 % | 64 % | 66 % |
| 3 | Carrot Toss | 96 % | 80 % | 22 % |
| 3 | Kitchen Garden | 89 % | 65 % | 27 % |
| 3 | Two for One | 90 % | 77 % | 0 % |
| 3 | Snack Run | 97 % | 90 % | 25 % |
| 4 | Double Trouble | 90.5 % | 68 % | 76 % |
| 4 | Pincer | 91 % | 65 % | 74 % |
| 4 | Hide and Seek | 92 % | 68 % | 69 % |
| 4 | Stampede | 88 % | 71 % | 88 % |
| 5 | The Big Pit | 88.5 % | 77 % | 68 % |
| 5 | Clever Clogs | 86 % | 51 % | 86 % |
| 5 | Outfoxed | 93.5 % | 82 % | 83 % |
| 5 | The Big One | 89 % | 57 % | 89 % |

The policy is a lower bound on good play: it only looks one turn ahead with its tools.

### The Daily Pit

A day's ground (rocks, burrows, patches, tools, kind of rabbit) comes from the day's number; the ground is solved
once (about 1.3 s) and hiding places are tried in a seeded order until one is fair: from the best drop, with no
tools, good play survives between 70 % and 92 % of the time. Generating a day takes 1.3 to 3.1 s. Over the 24 days
the check covers, the policy survived 87.5 % to 100 % of 80 games each; two days needed a second hiding place.

## Regression checks

`npm run check:ten-turns` (`scripts/check-ten-turns.ts`, about 25 s on eight cores; `--quick` for a faster pass):

- The 1970s module against the program: angles in all four quarters, the 23-degree boundary, B = 1, the frozen
  rabbit (on and off), the pull to rows 0 to 2 from every cell and angle, the step past the wall, the rabbit leaving
  the pit, the last-turn loophole (on and off), chain odds within 0.5 % (200,000 turns).
- The survival table above: best play exact to 0.2 %, simulated players within 2.5 % (runner) and 1.5 % (random).
- Classic: a fair cell for every drop, none below 40 %, and the real rules played with the solver's moves within
  2 % of the solved value.
- Tactics: solver and engine agree to 2 in 10,000 at sampled positions in five pits (plain, clever, jumper and stalker).
- Every campaign pit survivable by the policy: at least 88 % (chapter 1), 83 % (2 and 3), 78 % (4), 72 % (5);
  24 Daily Pits at least 70 %.
- `tests/unit/ten-turns-detokenize.test.ts`: the detokenizer on a hand-made program.

## Open questions

- **The author.** The Internet Archive's copy of the program notes credits Philip Stanway; we could not open the
  printed page of *More BASIC Computer Games* to read the credit ourselves. A scan of page 92 would settle it.
- **The book's version.** Ours is a PC adaptation (clock-seeded, clears the screen). Whether the book's listing had
  the same line 131 slip, or the slip came in when it was typed into the PC, needs the printed listing.
