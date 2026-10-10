# Outta Here: changes from the original

The soul we kept is the one idea in *Escape*'s eleven lines: **the walls grow while you hesitate**. An asterisk starts in the top-left corner of a 64 × 16 screen, the exit waits on the bottom row, and standing still is what fills the screen. Everything else in Outta Here is built around that race between your fingers and the blocks, and the original's bugs come back as tricks you can use. The original itself still runs, address by address, in 1980 mode. For how the original works, see [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md); for how the rebuild is put together, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Kept

| In the original | In Outta Here |
|---|---|
| A 64 × 16 screen | The same size, in every mode |
| An asterisk starts in the top-left corner | The star, an asterisk with a face, starts there too |
| The exit is a `+` on the bottom row | The exit is a `+` on the bottom row |
| Blocks fill the screen when you stop pressing keys | Blocks pile up fastest when you stand still |
| You can't walk through a block | You can't walk through stone (until a Mega bomb breaks it), or through glass until a bomb breaks it |
| Rows wrap at the edges (a bug) | **Edge tunnels**: off the right edge onto the next row's left, off the left edge onto the right end of the row above |
| Walking up off the top row makes the star vanish (a bug) | **Under the keys**: walk off the top row and you hide under a keyboard drawn above the screen |
| Walking off the bottom-left corner crashes the computer (a bug) | The Last Machine's screens have no exit: the way out is that corner |
| The bottom row stays clear | Kept on Chill |
| No way to lose | Kept on Chill, which has unlimited hearts |
| Comma and full stop move left and right | They still do, next to the arrow keys and `W` `A` `S` `D` |
| The title ESCAPE, with the star sitting on its E | The six letters E S C A P E to collect, and the `*SCAPE` joke on the game menu and in a keycap's name |

## Changed

| In the original | In Outta Here | Why |
|---|---|---|
| One kind of block | **Wood** slides when you walk into it, **glass** breaks in a bomb blast, **stone** stays | Three blocks give every wall a choice: push, bomb or go round |
| A block every time round the loop that no key is waiting, about sixty a second | The rain is measured in blocks a second: light while you keep moving, about three times heavier when the **hesitation** meter is full | Sixty a second leaves a person no time to think. "Pressing keys holds the rain back" became "moving holds it back", which also works with a held key or a touch pad |
| Blocks land anywhere, even on the star | Nothing lands in the eight cells around you until you have stood still for a moment (never on Chill). Only on Hard can a block land on you, and it costs a heart | Being buried by bad luck isn't a choice you made; standing still is |
| One press, one step | Hold a key to keep moving | Comfort. The original's `INKEY$` only ever saw a key go down |
| You can be boxed in for good, and only BREAK ends it | **The way-out rule**: a block that would seal your last way out lands as glass or shatters, wood won't slide if the push would box you in, and every screen starts with a way down that bombs can open | A run you can't finish is just a wait. The game keeps a way out open; whether you find it is up to you |
| No score and no message | A results card with three stars (got out, under par, all six letters), a score and a map of your route | So a run has an outcome worth beating |
| No way to lose | Hearts: unlimited on Chill, 3 on Normal, 2 on Hard | Chasers need something to take |
| The exit is always at column 30 | The exit sits on the far side from the last wall's gap | So the last corridor has to be crossed too |
| The screen starts empty | It starts with stone walls (each with a gap, so the way down zigzags), a few loose stones, and glass where the way down needs it | Each screen has a shape to read before the rain changes it |
| The bottom row stays clear, as a side effect of the random range | Kept on Chill; on Normal and Hard the bottom row can close too | On the harder levels the last corridor should be a real corridor |
| The wrap is invisible and works everywhere | Dashed seams mark the tunnels. There is none left from the top row or right from the bottom row, and wood can't be pushed through one | A trick has to be seen to be used |
| The vanished star is two rows deep in the keyboard's memory and can drift further off into memory | You hide one row up, under a drawn keyboard. Walk along it and drop back onto any empty top-row cell. Chasers, rain and bombs can't reach you there | A hiding place you can see and plan with, instead of a disappearing act |
| Stepping off the bottom corner ends the machine | On The Last Machine, reaching that corner wins: "Crashed it. Out!" | The worst bug becomes the finale |
| You can't step right from the very first cell | You can, in the modern modes | A bug that only gets in the way. 1980 mode keeps it |
| Any key wipes a block off the star | Gone with the buried star: a block never lands on you except on Hard, where it hurts | There is nothing to wipe |
| White on black, silent | Light and dark themes, five computer looks for the Screens, and sound effects | A game played today should look and sound like one |

## Added

- **Modes.** Run on three difficulties (Chill, Normal, Hard); Screens, thirty fixed screens on five old computers, each teaching one trick; the Daily Escape, one screen a day for everyone; Versus, two players on one keyboard; and 1980 mode.
- **Bombs.** One on the screen at a time (two on Chill); after 2.5 seconds they break the glass around them, set off other bombs, pop chasers and hurt you if you're too close.
- **The Mega bomb** (Normal and Hard). One waits on the screen at a time, never falling and never fading; you carry one at a time, and as soon as you pick it up another appears somewhere else. It goes off like a bomb but breaks every block in its blast, stone included.
- **Bonuses.** Chain ×3 and Chain Rush fall with the rain and turn bombs into chain bombs, whose blast runs on through touching glass.
- **Chasers.** The Bouncer patrols a lane, the Eraser follows and wipes your trail, Glitch hunts you by the shortest way, and on Hard the Copycat sets off from where you started and comes after you with your own tools: it pushes wood and bombs glass by exactly your rules, and shows every push and every bomb on screen before it happens.
- **The hesitation meter**, shown above the screen.
- **Letters, stars, par and score.** E S C A P E to collect, three stars per run, a par time for each difficulty and each screen, and a route map on the results card.
- **Computer tricks.** Gaps at the ends of the walls on the Amber Terminal, stone pillars on the Home Micro, sand rain on the Pocket LCD, and no exit on The Last Machine.
- **Keycaps and the Keyring.** Fourteen achievements in three tiers, collected on the Any Key Keyring with every other game's; the Daily counts towards the collection's daily streak.
- **The Daily's share text**: the time, the stars, the hits and ten coloured squares that sum up the run.
- **The navigation standard**: a pause menu with How to play and Settings, results with the same three actions as every Any Key game, and browser Back that asks before throwing away a run.
- **Touch controls**: an arrow pad, a Bomb button and (on Normal and Hard) a Mega button on touch screens, and touch keys in 1980 mode.
- **A live Hall preview**: the human-like bot that tests the balance plays Normal screens in miniature on the game's card.

## Left out

- **BASIC's `READY` prompt at the end of a run**, in the modern modes. A results card says how it went instead. 1980 mode keeps the prompt.
- **The invisible star and the walk into memory.** Under the keys you are hidden from the chasers, never from yourself, and you can't go further than one row up. 1980 mode keeps the real thing.
- **The crash as a crash.** Nothing breaks in the modern modes; the corner is only a way out in the finale. 1980 mode keeps an impression of the crash.
- **The copied right-hand check**, in the modern modes, as above.
- **The title as a target for the rain.** The blocks no longer eat the letters; the letters are now yours to collect.
- **A block about every sixtieth of a second.** Only 1980 mode runs at the original's pace.

## Faithful modes

**1980 mode** is the faithful mode. It doesn't play a remake: it runs our own simulation of the eleven lines, keeping the star as an address, as the program did.

It reproduces exactly:

- the screen as 1,024 character cells from address 15360, starting with the title in the top-left corner and the star on its E, so it reads `*SCAPE`, and the `+` at row 15, column 30;
- the main loop: a key if one is waiting, otherwise a block at a random cell from 1 to 960 past the top-left, so the bottom row stays clear apart from its first cell, the exit is never covered, and a block can land on the star;
- the four movement checks as written, wrong ones included: no step right from the first cell, rows wrapping at both ends, two rows up into the keyboard's memory (where the star is invisible and nothing blocks it) before the third step is refused, and the step off the bottom-left or bottom-right corner;
- a move into a block refused, and any key at all clearing a block off the star;
- the very first erase, which goes to address 0 (ROM) and changes nothing;
- the end: reaching the `+` stops the program with `READY` and `>` under the title, the star one step short of the exit;
- no key repeat, and no sound.

Where it has to guess:

- **The speed.** The loop runs sixty times a second. That is our estimate for interpreted Level II BASIC on a 1.77 MHz Z80 (somewhere between 50 and 70); nobody has timed the program on a real machine for us.
- **The keys.** Every press is queued and taken one per loop. The real `INKEY$` only looked at the keyboard when line 40 ran, so a very fast burst of keys may have lost some on a TRS-80.
- **The crash.** Writing over address 16384 broke BASIC, but what the screen did next depended on the machine. Ours freezes the picture for a moment, then spills random block graphics and letters over it, and offers to switch it off and on. It is an impression, not a recording.
- **The letters.** The few characters the program and BASIC show are drawn in our own 5 × 7 dot letters, not the TRS-80's character set. The block graphics follow the TRS-80's 2 × 3 grid, and the cells keep its proportions (three times as tall as they are wide).
- **The random numbers.** Our seeded generator stands in for Level II's `RND`; only the range, 1 to 960, is the original's.

And what we added around it: the screen opens at BASIC's prompt with `RUN` already typed, waiting for Enter; the arrow keys left and right stand in for comma and full stop (the TRS-80's own left and right arrows did nothing); a line under the screen says where the star is, because the screen can't; the end shows the time, the key presses and how many blocks fell; and the run can be paused. Getting out earns the `*SCAPE` keycap, and the crash earns a secret one.
