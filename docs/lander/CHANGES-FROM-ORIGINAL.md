# Don't Crater: changes from the original

The soul we kept is one hard choice, made over and over: fall freely to save fuel, then brake late enough to arrive with an empty sky and a full stop. Don't Crater flies the 1979 program's own equations, worlds and speed ladder, and builds the help, the goals and the looks that a player today expects around them.

For how the original works, see [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md). For how the rebuild is built, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Kept

| In the original | In Don't Crater |
|---|---|
| The flight equations: gravity that weakens with height, an engine that pushes harder as the tank empties | The same equations, in every mode |
| Its unit slips: gravity divided by 36 instead of multiplied by 0.036, and 3,200 seconds to the hour | Kept on purpose: they are what makes each world feel the way it does. Every world pulls at 77% of its real strength |
| Each world's height, fuel and engine derived from its gravity | Same recipe, same results for Earth, the Moon and Mars |
| Every flight starts at 5,000 km/h, straight down | The same, except where a mission or the Daily Drop changes it |
| Survive under 20 km/h; a flag at 5 km/h or less; excellent under 2 | The same bands: Bumpy, Smooth and Butter. The flag goes up under 5 km/h |
| A crash ladder that ends in a joke: a new crater, then oil at 5,000 km/h and up | The same ladder with new names, and oil still awaits anyone who never fires the engine |
| Ten-second turns with a typed burn | Ten-Second mode |
| A picture that closes in on the ground as you fall | A continuous zoom from orbit to the pad |
| One player against gravity | Still one player; the Daily Drop lets friends compare the same descent |

## Changed

| In the original | In Don't Crater | Why |
|---|---|---|
| A burn typed every ten seconds | **Live** mode: a throttle lever, number keys and hold-to-burn in real time, with time warp while nothing can happen | Real-time control is how people expect to fly today, and warp keeps the long fall from being dull |
| Earth, Moon, Mars and an invented "Asteroid Alpha" | Earth, Moon and Mars with the same numbers; the asteroid becomes **Psyche**, a real metal asteroid of similar gravity (NASA's probe of the same name arrives in 2029) | A real place is more interesting to visit, and its gravity plays almost the same |
| Flight worked out in ten-second jumps, with approximate touchdown and fall formulas | The same equations integrated in 20 ms steps; touchdown is found inside the step, so the impact speed is exact for the model. Running dry is simulated to the ground (it agrees with the 1979 shortcut to within 4%) | A real-time game needs a smooth flight, and an exact impact speed is fairer to judge |
| Six fixed pictures of the ground, chosen by height | A log-scale camera that zooms smoothly, over fractal ground with detail at every height | The zoom was the original's best idea; now it never jumps |
| Block graphics in black and white | Canvas, SVG and CSS drawn in code; the light theme is each world's day side, the dark theme its night side | Both themes are designed, not inverted, and switch live |
| Landed, crashed, disintegrated, a new crater, struck oil; pilots hurt or killed | Butter, Smooth, Bumpy, Dented, Scrap, Confetti, New crater, Oil, each with its own animation. Nobody gets hurt: the pilot always gets away | All ages; the jokes stay, the injuries go |
| The picture says "wreck" from 19 km/h, the text says "crash" from 20 | One cut-off, 20 km/h, everywhere but 1979 mode | A modern verdict should not contradict itself |
| A hidden flag for landings at 5 km/h or less | Your own flag, designed on the game menu, planted by your astronaut under 5 km/h | The best moment in the original deserved to be yours |
| No help beyond a page of instructions | A **burn guide** (the stop point), callouts, a **landing assist**, final-approach advice and a **flight recorder** that compares your flight with a perfect one | Players born decades later need to see the physics to learn it |
| One tank per world | **Fuel**: Generous, Standard (the original tanks) or Tight, in every mode but 1979 mode; and Unlimited in Free Flight, which refills the tank and counts the refills | Room to learn, a harder setting for experts, and a no-pressure way to practise that still shows progress |
| The clock never resets between games | Every flight has its own clock (1979 mode keeps the old one) | A result should describe one flight |
| A refused burn flashes a warning twenty times | The throttle simply can't leave 0–100 | Nothing to refuse with a lever |
| "Try again?" with 1 or 2 | A result card with Fly again, Game menu and Back to the Hall, plus Share | The collection's navigation standard |

## Added

- **Missions:** ten landings in order with stars, each with a twist: cargo, a short tank, a hot entry, dead instruments, a needle-fine touchdown.
- **Daily Drop:** a world, entry speed, fuel load and cargo chosen from the date, the same for everyone, checked to be fair, with a shareable result.
- **Free Flight:** the 1979 equations in two dimensions. The lander leans, drifts sideways, trims the drift with side jets and must stand upright on flat ground among rocks, on generated sites or six named ones, with a planned target and a scan assist.
- **Ten-Second prediction:** a dotted path, a ghost lander and a check of whether a full burn would still stop you.
- **Time warp**, the **last 30 m at half speed**, and a fast-forward when the tank is empty and the ending is decided.
- **Fifteen achievements** as keycaps on the Keyring, six of them unlocking flag emblems.
- **A flight log** and the best touchdown on each world.
- **Synthesised sound**: engine, callouts, warnings, touchdowns, crashes, the oil gusher, and in Free Flight the thrusters, the tip-over and the splash.
- **Touch controls**: the lever, a BURN button, rotate buttons, and a keypad in 1979 mode.
- **1979 mode** itself, described below.

## Left out

- **The original's words and pictures.** No message, sprite or ground picture from the listing is reused, in any mode. Every line on screen was written for Don't Crater.
- **Injuries and deaths.** The 1979 verdicts hurt or kill the pilot; ours never do.
- **The name "Asteroid Alpha".** Psyche replaces it in the modern modes; 1979 mode calls it simply "an asteroid".
- **The approximate impact and fall formulas**, outside 1979 mode. The modern modes have no need for shortcuts.
- **The pauses.** The original asks you to wait while it builds its pictures; 1979 mode keeps a short pause for flavour, the rest of the game has none.
- **The three skill levels** that Simutek's catalogue promises. Our listing has none, so there was nothing to keep; the fuel setting plays that part.

## Faithful modes

**1979 mode** (`components/dontcrater/Terminal1979.tsx`, with the arithmetic in `lib/lander/original.ts` and the screen in `components/dontcrater/trs80.ts`) is the original, turn for turn.

What it reproduces exactly:

- The arithmetic of every turn, including the fuel taken out before the push is worked out, the turn shortened when the tank runs low (and never lengthened again), the touchdown estimate and the out-of-fuel fall speed and fall "time".
- The starting numbers of all four worlds, from the original gravity and radius (the asteroid at 17.5 cm/s² and 195 km, not Psyche).
- Fractional burns, refusing burns below 0 or above 100 with no time passing, and the burn reset to 0 after a refusal.
- The verdict bands and both cut-offs: a wreck from just over 19 km/h, a crash from 20, the flag at 5 km/h or less (exactly 5 gets the rough line and the flag), the explosion above 45, oil from 5,000.
- The **clock that never resets** between games, and the previous game's last speed carried into the next.
- The ground redrawn at 100, 50, 25, 10 and 1 km, the lander stepping down at 800, 600, 300, 200 and 100 m, dust near the ground, the flame flickering once for every 5 units of burn, the wreck with nine rounds of rising sparks.
- The question flow: instructions yes or no, a world from 1 to 4 (asked again until valid), a burn each turn, try again 1 or 2 (asked again until valid).
- A 64 × 16 character screen whose codes 128–191 are 2 × 3 pixel blocks, with big 32-column letters for the title.

Where it has to guess, or chooses to differ:

- **Level II BASIC's `INPUT`.** Text is met with `?REDO` and `Enter` on its own keeps the last value. This is our understanding of the machine, not yet checked in an emulator.
- **The pictures and the words** are new: our own sprites, our own panel labels, our own verdict lines, and the asteroid is "an asteroid". The ground is new too: all six pictures are generated once per run from a random seed, where the original had three random strips and three fixed drawings.
- **Timing.** The original's pace came from empty loops on a 1.77 MHz Z80. 1979 mode uses fixed delays and shortens the long animations: the refusal flashes 6 times instead of 20, the explosion 8 times instead of 20, the flag waves 36 times instead of 45, and the flame count is rounded and capped at 24.
- **The last 100 m.** Both stop drawing the flame there and kick up dust instead, but the original flickers the dust twice per unit of burn, and 1979 mode once per 5 units, like the flame above it.
- **The "no survivors" line** sits under the headline like every other second line, not in the middle of the screen.
- **After "no".** The original clears the screen and ends. 1979 mode shows a `READY` prompt; typing `RUN` starts it again with a fresh clock, as running the program again would.
- **Additions.** A keypad for touch screens, the pause menu, and two keycaps (Time Traveller, and a secret one for the 19-to-20 blind spot).
