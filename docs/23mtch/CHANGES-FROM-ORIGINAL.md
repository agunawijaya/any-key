# Stickler: changes from the original

The soul we kept: one pile, take 1 to 3, the last one loses, and a computer that never misses a chance to win, so the only way to beat it is to find the secret yourself.

## Kept

| In the original | In Stickler |
|---|---|
| 23 matches, take 1–3, whoever takes the last one loses | The same, as **Classic 23**. The same rule powers every mode |
| You always move first, from a count you can always win | Kept in Classic. Every other table you meet against Sparky can be won too, even the ones where he opens |
| When it can win, the computer plays a perfect formula | **Master** Sparky always takes a winning move when one exists, and the Daily and the harder Ladder tables use him |
| Every take may be a single match, so the loser is left holding one | Kept in every mode but Handfuls, where a take floor turns the ending into a sweep |
| A rule-breaking number costs nothing: a complaint, and you try again | Sparky objects and you pick again. No turn is lost and there is no penalty |
| The game teaches: the book shows how to reason backwards to the winning numbers | The Coach teaches the same idea in three steps, inside the game |
| After each game a new one starts at once | **Rematch** (`R`) deals the same table again straight away |

## Changed

| In the original | In Stickler | Why |
|---|---|---|
| Text only: a count, a prompt, type a number | A table of sticks you click, with take buttons and number keys plus `Enter` | A pile you can see is read faster than a number, and the keys keep play quick |
| Matches | Sticks in three styles: Matches, Glow sticks and Candy sticks | Three looks to choose from, and a name that fits all of them |
| One computer opponent | **Sparky** at three levels: Rookie guesses half the time, Clever slips one move in five, Master is perfect | New players need an opponent they can beat before they know the trick |
| When losing, a "random" take that on a PC is always 1 | Sparky picks a really random move that avoids the last stick. **1981 mode** keeps the always-1 behaviour | Once noticed, a fixed reply makes the computer feel broken; the faithful version lives in its own mode |
| Left one match, the computer concedes without taking it | Sparky has to take the last stick, and it goes up in flames | The last stick is the moment players remember, so it gets a payoff |
| Any bad input is "cheating" | Sparky is a *stickler for rules*: he objects in his own words, and the first refusal earns a secret keycap | The same joke, less of an accusation, and a small reward for testing the rules |
| Win or lose, you learn nothing | A **Coach** with three hint steps, and an after-game **key moment** that shows exactly where the game was lost | The original's lesson was in the book; now it travels with the game |
| No score, no record | Move squares, Ladder stars, a record of wins, losses and best streak, and 14 keycaps on the collection's Keyring | Players like to see progress |
| An endless loop: only Ctrl+Break stops it | Rounds that end in a results card, a pause menu, a **Game menu** and **Back to the Hall**; leaving a game in progress asks first | Every Any Key game moves the same way (`docs/NAVIGATION.md`) |
| 23 matches every time | Other counts, take limits, rows, a take floor and who opens, across the Ladder, Handfuls, the Daily and Versus | The trick is learned in minutes; the variations keep it a puzzle |

## Added

- **Handfuls**: every take has a floor as well as a limit (2–3 up to 4–6), and fewer than the floor left means sweeping the whole pile. The magic numbers become magic zones. With **Surprise pile** and **Sparky starts**.
- **The Ladder**: ten tables with fixed opponents, from an 11-stick warm-up to bigger take limits, rows played as misère Nim, and the 1-3-5-7 Marienbad table, where Sparky opens. Up to three stars each.
- **The Daily**: one table a day, the same for everyone, always winnable, with a share text of coloured squares.
- **Versus**: two players on one screen, with six tables including two Handfuls ones.
- **Sparky**: a face with eight moods, his own lines, thinking time that gives away when he is in trouble, and a voice of little blips.
- **The Coach, the move squares and the key moment.**
- **14 keycaps** in three tiers, kept in the Keyring with every other game's.
- **Three stick styles**, each with its own table, sounds and ending, in light and dark.
- **The endings**: the last stick flares with embers, soot and a shake, and a Handfuls sweep sets off the whole pile.
- **1981 mode**, a playable recreation of the original on a PC (see [Faithful modes](CHANGES-FROM-ORIGINAL.md#faithful-modes)).
- **Full keyboard play**, sound with a mute switch and volume, reduced motion, and the Story tab with these six chapters.

## Left out

- **The original's words.** The rules text, the count line, the cheating message and both victory messages are not reused, in any mode. The listing is copyrighted; everything Sparky and the 1981 terminal say is new.
- **The concession, in the modern modes.** Sparky takes the last stick instead (see Changed). 1981 mode keeps the concession.
- **The random losing move of DEC's BASIC.** On the DEC machines the losing computer took 1, 2 or 3; 1981 mode follows the PC, where it always takes 1. The modern modes have their own random move.
- **The endless loop with no way out.** Replaced by rounds, the pause menu and the Game menu.
- **The always-plural count** ("1 MATCHES"). The modern board says "1 stick left"; the 1981 terminal's count line avoids the plural altogether.

## Faithful modes

**1981 mode** (`components/stickler/Terminal.tsx`) recreates the original as it behaved under GW-BASIC on an IBM PC. It is called 1981 after the PC, not after the program, which is from 1973.

What it reproduces exactly:

- **The pile and the opener.** 23 sticks, and you always move first. The rules are shown once per visit to the mode, and each game is followed by a new one at 23 with no score and no replay prompt.
- **The input checks, in the original's order:** more than what is left, not a whole number, zero or less, four or more. Each gets the same complaint and another try, with no penalty and without repeating the count. A whole number written with a decimal point, such as `2.0`, is accepted. An empty answer counts as 0 and is refused, as BASIC's `INPUT` reads it.
- **Text instead of a number** gets `?Redo from start`, BASIC's own reply, and never reaches the checks.
- **The computer's move**, through `move1981` in `lib/stickler/sparky.ts`: with R = sticks mod 4, it takes (R + 3) mod 4 when R is not 1, and INT(3 × .3116351) + 1 = 1 when R is 1. That is GW-BASIC's `RND(0)`, which repeats its fixed starting value because the program never advances it (see [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md#what-rnd0-really-does)).
- **The concession.** Left one stick, the computer gives up without taking it. It never takes the last stick, so the original's dead check at line 370 has nothing to reproduce.
- **One line for the computer's take and the new count**, as the original prints them.
- **A perfect game goes the same way:** you take 2, then 3 five times, the computer takes 1 every time and concedes. The check script confirms the formula from every count up to 23.

Where it has to guess, or chooses to differ:

- **The words are new**, and the matches are sticks. The layout of each line follows the original; the wording does not.
- **The re-prompt after `?Redo from start`.** GW-BASIC shows a bare `?`; the terminal shows its own prompt again.
- **Number syntax.** The terminal reads digits with an optional sign and decimal point, up to six characters. BASIC's `INPUT` also reads forms such as `1E0`, which the terminal answers with `?Redo from start`. We have not compared the two in an emulator.
- **Which machine.** The PC's always-1 move is what our copy of the file does. On DEC's BASIC-PLUS the losing move varied from 1 to 3, and how IBM's BASICA behaves is unverified; the terminal does not offer either.
- **The way out.** There is no Ctrl+Break: `Esc` (even while typing) and the Pause button open the pause menu, and leaving after the first take asks first.
- **Small additions.** Quick buttons for 1, 2, 3 and a cheeky **4?**, and the Time Traveller keycap for a win. Games in 1981 mode don't count in the record.
