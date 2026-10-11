# Sol y Sombra: notes

The lab book: what we verified about the 1970s program, how, the simulations behind the Classic corrida's balance, and the measurements behind the rig and the art. Line numbers are the BASIC listing's (`BULLFGHT.BAS`, 193 lines). The listing stays outside the repository; everything here is in our own words.

It follows the stages: the original and its simulations (stage 3), the rig (stage 1), the art (stage 2), the game and its beats (stages 4 to 7) and the critique of the whole (stage 8).

## Verified facts about the original

All read from `BULLFGHT.BAS` (193 lines of Microsoft BASIC; the listing printed in _BASIC Computer Games_, Creative Computing, 1978) and replayed by `lib/sol-y-sombra/original.ts`, which keeps the program's order of random draws. Numbers in brackets are listing lines.

1. **The bull's quality** `A` is a whole number from 1 (superb) to 5 (awful), drawn once [455]. A superb bull is the dangerous one: it adds to the top of every risk formula. An awful bull gets a "you're lucky" message [530], a superb one a wish of luck [550].
2. **The crews are drawn from the bull.** Both crews' ratings come from `B = 3/A × RND` [1610], cut into a rating `C` of 0.1 (superb) to 0.5 (awful) [1620–1740] and printed through `T = INT(10C + 0.2)` [1750]. A superb bull brings superb crews 71% of the time, an awful bull awful crews 62% (2/3 · 0.87… and 0.37/0.6 by hand; 71.2% and 61.1% by simulation). The brief described the draw without this link.
3. **The inversion.** In the goring test `F = (6 − A + M/10) · RND / ((D1 + D2 + pass/10) · 5)`, gored at 0.51 or more [940], and in the kill test `K = (6 − A) · 10 · RND / ((D1 + D2) · 5 · pass)` [1230], the crews' ratings sit underneath, so a worse job (larger `C`) makes the matador safer and the kill easier, while the instructions [380–390] promise the opposite. For a fair bull's first veronica the chance of a goring is 76.8% with two superb crews and 15.0% with two awful ones; a kill at pass seven succeeds 4.7% and 23.3% of the time. In the crowd's verdict [1390] the same ratings are subtracted, so there a better job does help.
4. **Casualties.** A fair or better job reports nothing [1770]. An awful job reports one or two of the crew lost, and for the picadores one or two horses too [1870–1890]; those lines run. A poor job [1790] reports one man or none and jumps past the only other horse line [1800–1810], which can never run. The brief's "horse lines are unreachable" holds for that one line.
5. **The cape moves.** 0 veronica, 1 outside, 2 swirl add 3, 2 and 0.5 to the bravery total `L`, which starts at 1 [202, 860–930]. In the goring test the move adds only `M/10` to the top, so a veronica is barely riskier than a swirl: for a fair bull and fair crews the first pass gores 45.9% of veronicas and 41.5% of swirls.
6. **Later passes are safer.** The pass number divided by ten joins the crews underneath [940], and multiplies the kill test's bottom [1230]. Passes one and two ask "kill?" one way, later passes another [710–790]: hence the instructions' advice to wait for the seventh pass [310–320].
7. **Gorings.** After a goring a coin decides death [970–1000]. Alive, the matador is asked whether to run [1020]: running is cowardice, the crowd boos and gives nothing [1040–1060, 1340–1380]; staying is brave, and another coin either lets him carry on with the brave flag set [1080–1100] or gores him again [1110–1120].
8. **The two kills are the same.** At the moment of truth 4 and 5 both go to the kill test [1170–1230]; line 1240 tests `J`, which is never assigned, so both face the 0.2 test. Had it read `H`, going over the horns (4) would have used a test four times as forgiving [1290]: a fair bull at pass seven, fair crews, would fall 56% of the time instead of 14%. Any other number is a panic, and a goring [1190]. In 2,000 seeded games played twice, once with each method, the two never differed.
9. **A failed kill can end with cheers.** Gored at the moment of truth, staying and surviving sends the program back to the pass loop [1100], which sees the kill already tried [680] and goes straight to the verdict, with "the crowd cheers wildly" [1410], though the bull still stands.
10. **The crowd rolls three times.** The merit is `FND = 4.5 + L/6 − (D1 + D2) · 2.5 + 4 · D4 + 2 · D5 − pass²/120 − A` [1390], where `D4` is 1, 2 for bravery after a goring, 1.5 after a fatal one and 0 for running, and `D5` is 2 after a kill. `FNC` multiplies it by a fresh `RND` at each of three tests [1395, 1460–1480]: nothing below 2.4, one ear below 4.9, both ears below 7.4, the top award otherwise. On average a verdict uses 1.95 rolls.
11. **Awards after death.** A fatal goring sets `D4` to 1.5 and goes to the verdict like any other ending [990–1000]: in 1,863 of 1,863 simulated fatal gorings the crowd still gave an award.
12. **Inputs.** The cape move must be a whole number from 0 to 2 [810–840]; 4 and 5, offered by the instructions "on any turn", are refused there, because the kill is reached only by answering yes first. Yes and no must be exactly `YES` or `NO` in capitals [1930–1980]. The instructions are shown for any answer except exactly `NO` [207]. Non-numbers at a numeric question get the interpreter's "redo from start"; an empty answer reads as zero, which makes it a veronica (Microsoft BASIC behaviour, from its manual, not run here).
13. **No `RANDOMIZE`.** Every run on a freshly loaded interpreter deals the same afternoon.

## Quirks, and what our game does with them

| Quirk                                     | The 1970s mode                             | The Classic corrida                                                                                                  |
| ----------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| The inversion (better crews, more danger) | Kept                                       | Mended: better work makes every pass safer, and the crew's card says by how much                                     |
| Crews drawn from the bull                 | Kept                                       | Dropped: the crews' work is drawn on its own, mostly middling                                                        |
| The two kills alike                       | Kept                                       | Mended into two real choices: over the horns (steadier) and waiting for the charge (riskier, the crowd rises for it) |
| A veronica barely riskier than a swirl    | Kept                                       | Mended: risk and reward now differ a lot between moves, and the cards show both                                      |
| The triple roll                           | Kept                                       | Mended: one roll, from a meter the player watches fill                                                               |
| Death in the ring, awards after it        | Kept, in neutral words (owner, 2026-10-10) | Nobody dies: a serious goring ends the afternoon with the matador carried to the infirmary, alive                    |
| YES / NO in capitals                      | Kept                                       | Buttons and keys                                                                                                     |
| Boos for running                          | Kept                                       | Retiring after a goring is allowed; the crowd is cooler, not hostile                                                 |

## Simulations of the original

`lib/sol-y-sombra/originalSim.ts`, 40,000 seeded games per line (`npx tsx scripts/check-sol-y-sombra.ts --n=40000`). Bots answer the questions as written; after surviving a goring they always stay.

| Strategy                         | Kills | Dies  | Top award | With every mistake mended: kills / dies / top |
| -------------------------------- | ----- | ----- | --------- | --------------------------------------------- |
| Always veronica, kill at pass 3  | 9.0%  | 73.3% | 7.6%      | 15.2% / 71.8% / 18.7%                         |
| Always veronica, wait for pass 7 | 19.7% | 70.0% | 9.9%      | 26.8% / 69.6% / 22.7%                         |
| Always swirl, kill at pass 3     | 8.9%  | 72.0% | 5.5%      | 17.1% / 68.7% / 14.5%                         |
| Always swirl, wait for pass 7    | 20.3% | 68.9% | 5.2%      | 31.4% / 64.0% / 14.5%                         |
| Kill at once                     | 3.4%  | 64.3% | 6.5%      | 8.5% / 60.6% / 15.8%                          |

- **Waiting pays, slowly.** With veronicas, killing at pass 1 succeeds 3.2% of the time, at pass 7 19.4%, at pass 14 34.5%; deaths fall from 74% (pass 4) to 60% (pass 14).
- **The inversion alone, mended,** makes the waiting strategy deadlier (deaths 70% → 83%): mended, the mild bulls that came with poor crews lose their safety, and the dangerous bulls that came with superb crews don't gain enough. The link between bull and crew had half-cancelled the inversion.
- **The kill choice alone, mended** (going over the horns), lifts kills from 20% to 46% and cuts deaths to 52%.
- **The triple roll alone, mended,** changes no ending but the awards: the top award goes from 10% to 25%. For a merit of 11, three rolls give nothing / one ear / two ears / top 21.8 / 34.8 / 29.2 / 14.2%; one roll would give 21.8 / 22.7 / 22.7 / 32.7%. The extra rolls pull the crowd towards the middle.
- **Crews by the extremes:** with both crews superb, waiting for pass seven kills 0.0% and dies 99.3%; with both awful it kills 45.8% and dies 38.8%.

## The Classic corrida: balance

`lib/sol-y-sombra/rules.ts` holds every number; `lib/sol-y-sombra/bots.ts` plays it. 10,000 corridas per bot. A serious goring ends the afternoon in the infirmary.

| Bot      | Plays                                                                                          | Gored | Seriously | Silence | Applause | Lap   | Shoulders |
| -------- | ---------------------------------------------------------------------------------------------- | ----- | --------- | ------- | -------- | ----- | --------- |
| careful  | swirls and outside passes, finish at pass 6 over the horns, retires when gored                 | 15.6% | 5.1%      | 16.7%   | 68.1%    | 15.2% | 0.0%      |
| balanced | veronicas with a swirl every third pass, finish at 6 over the horns, carries on once           | 31.8% | 12.8%     | 3.0%    | 18.7%    | 55.9% | 22.3%     |
| brave    | veronicas and outside passes, finish at 7 waiting for the charge, always carries on            | 51.3% | 26.0%     | 2.4%    | 27.0%    | 6.6%  | 64.1%     |
| reckless | veronicas only, finish at 9 waiting                                                            | 54.5% | 27.1%     | 2.4%    | 26.9%    | 0.1%  | 70.6%     |
| reader   | reads the cards: veronicas while cheap, the safest move otherwise, the bold finish when likely | 39.9% | 15.1%     | 2.5%    | 25.1%    | 52.3% | 20.0%     |

Design targets, locked by the check script: careful play is seldom hurt (serious ≤ 8%) and earns applause, never the shoulders; bravery is what fills the meter, and the shoulders cost real risk. **Every kind of draw is winnable**: across every bull quality, crew work (masterly, fair, poor) and pair of tells, the best of the five bots reaches the shoulders at least 45% of the time (hardest: a magnificent bull, poor crews, hooking left, keeping his strength), and careful play is seriously gored at most 12% of the time.

The cards' odds are what the engine rolls: for a noble bull with mixed crews, 20,000 first passes each, the veronica card said 13.9% and the engine gored 13.4% (within four standard errors); outside 6.5% and 6.5%; swirl 2.2% and 2.2%. The verdict's displayed odds match its roll within 1.5 points.

## The motion prototype (stage 1)

The prompt asks for the rig first: a plain ring where the matador performs the veronica, the outside pass and the swirl against a charging bull, with a cloth cape, seen from two camera angles, critiqued for foot sliding, popping, weight and cape behaviour. It lives at `/sol-y-sombra` while the game is being built (`components/sol-y-sombra/lab/`), on top of the rig in `lib/sol-y-sombra/rig/`.

### How the rig works, in one paragraph

Both bodies are 3D and solved fresh every tick (240 a second) from intentions, not keyframes. The matador's feet stay on planted spots until a booked step rolls them heel-to-toe or turns them on the ball of the foot; the pelvis rides over the weighted foot, never higher than both legs reach; a three-part spine shares the chest's turn; arms and legs are two-bone IK with soft reach. The bull is steered like a carriage and trailer, its legs placed by a gait clock (walk, trot, gallop blended by speed) at speed and by need when still. A pass is planned whole when it starts: the bull's run, braking and turn on the hindquarters, and the cape's angle round the matador kept a set lead ahead of the horns. The cape is a 17 × 12 Verlet cloth pinned in both fists, pushed by air on every face and by the bodies it meets.

### Critique rounds

| Round     | Looked at                                                                                                                               | Found                                                                                                                                                                                                                                  | Changed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1         | Three stills of a veronica from the stands                                                                                              | Figures far too small; the cape a narrow flag; the yellow lining dominating                                                                                                                                                            | Camera frames both bodies; hands hold the cape near its corners, 0.8 m apart; a red lining                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2         | The same stills, then a frame-by-frame recording                                                                                        | Bull drawn as a pile of outlined sausages, legs like sticks                                                                                                                                                                            | One outlined silhouette for body, neck and head; muscle at the top of each leg; far legs darker and behind                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 3         | A pass frame by frame                                                                                                                   | Tail a rigid rod; cape shading flat, no folds; the matador hidden whenever the bull passes on the camera's side                                                                                                                        | A tail stiff only at its root; smooth normals with a key and a fill light; the opening pass now goes by on the far side                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 4         | Numbers from a headless probe, every tick                                                                                               | A pop between beats (wrists jolting 31,000 m/s²); horns 6 cm inside the matador on a veronica; the swirl turning only 210°; the bull turning to face him with its horns 1.2 m off; heads snapping across when the target passed behind | Beats hand over from the planned intent; the bull's head can hook less with its head down; the swirl has its own spin; runs are lengthened until the turn leaves the horns about 3 m off; gaze and head follow springs that never flip                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 5         | Low camera, both appearances; jerk peaks traced one by one                                                                              | Knee and pelvis jolts at the toe-off and when the weight changed feet; the bull's withers jumping when it began to brake; the veronica crouched; the lining too dark                                                                   | Step phases joined by curves that match speeds; weight carried by a spring; braking and head carriage eased; a taller veronica; a brighter lining                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 6 (owner) | The owner's review: the bull not good enough, "something hanging from its neck", the bull needs angry eyes, can the matador have a face | The hanging thing was daylight: the dewlap, drawn as its own fold, swung away from the neck and left a gap; the head merged into the neck as one blob; the eye sat edge-on to most cameras                                             | The head is its own outlined shape over the neck (jaw line, cheeks, pale muzzle with nostrils, the line of the mouth, the curly forehead); the dewlap is webbed to the neck; the eye is drawn in its own plane, looking forward, with the white showing under a brow pressed down over its front; a tapered tail with a soft brush; the matador's head is a ball with a face on it (eyes, brows, a nose that shows in profile, mouth, ears), a hair cap tiled on the ball so only what faces us is drawn, the ornament at the back of the head, a lobed hat; a shirt front and tie when he faces us; gold down the outside of the thighs; two close-up cameras (Bull, Matador) |

### Measurements (lab loop: three veronicas, an outside pass, a swirl, a walk; 58 s)

| Measure                          | Result                                                          | How                                                                 |
| -------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| A planted foot or hoof moving    | 0 mm, every tick                                                | Probe compares each planted toe, heel and hoof with the tick before |
| Peak joint acceleration, matador | 55–100 m/s² (wrists 65, knees 86, pelvis 73)                    | Second difference at 240 Hz                                         |
| Peak, bull's head                | 227 m/s² (the hook of a swirl)                                  | Same                                                                |
| Horns to the matador's trunk     | 0.29 m at the closest                                           | Horn points against a 16 cm capsule from pelvis to neck             |
| Horns to the matador's arms      | 5 cm at the closest (the cape hand on a veronica)               | Same, 4 cm arm capsules                                             |
| Fastest cape particle            | 20 m/s (the hem whipping)                                       | Particle speed every tick                                           |
| Simulation cost                  | 0.24 ms a tick, about 1 ms per 60 fps frame                     | 60 s of ring in Node                                                |
| Frame rate at 1920 × 1080        | 60 fps with a GPU (both cameras), 53 fps on a software renderer | 300 frames of `requestAnimationFrame` in Chromium, dev server       |

### Recordings

`docs/sol-y-sombra/media/motion/`: `motion-stands.webm` (the whole loop from the stands, light, with the slow motion at each closest moment), `motion-barrier-dark.webm` (two veronicas from behind the boards, dark), `close-bull.webm` and `close-matador-dark.webm` (the two close-up cameras), `sheet-veronica.jpg`, `sheet-outside.jpg`, `sheet-swirl.jpg`, `sheet-close-bull.jpg`, `sheet-close-matador.jpg` (twelve frames each) and `rig-bones.jpg` (the bones and the planted feet drawn over a veronica). The frames were rendered by the lab one at a time and assembled with ffmpeg.

The figures are drawn by `components/sol-y-sombra/render/bullFigure.ts` and `matadorFigure.ts`, which the Vintage Poster style will dress in its own colours and ink.

## The hero frames and the title (stage 2)

The owner approved the motion on 2026-10-10 (and the hero frames the same evening, with stage 3 to follow), asking for fingers on the hands (now a palm, four two-jointed fingers and a thumb that close round the cape and open when free) and confirming that the stands would be full of people.

`docs/sol-y-sombra/media/hero/`: `veronica-*.jpg` (the horns in the cape at the closest moment), `crowd-*.jpg` (the stands rise after a salute, flowers and hats on the sand, the matador's name stamped over the sky), `shoulders-*.jpg` (carried out on two men's shoulders towards the open great gate), each light (the afternoon) and dark (the evening festival under lamps). All are drawn live by the Vintage Poster style over the real rig: `/sol-y-sombra?shot=veronica|crowd|shoulders`, `&t=still` for the frame.

### Critique rounds

| Round     | Looked at                                             | Found                                                                                                                                             | Changed                                                                                                                                                                                                                                                                |
| --------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | The veronica, light                                   | The bull's horns lost against the sky-coloured shade; every spectator waving; the dust as blurred discs; the ribbon floating under the frame      | A deeper shade ink for figures and the cape; fewer raised arms during a pass; dust as a stipple of dots; muted crowd inks fading with distance; the ribbon on the window's bottom rule                                                                                 |
| 2         | Three framings of the same moment                     | A chunky matador; side-on framings hid the cape or left the bull small                                                                            | A slimmer matador (narrow sash, short broad jacket); a three-quarter view from a little above                                                                                                                                                                          |
| 3         | The veronica, both appearances                        | Shadows too dark and blotchy; the evening needed light sources; the cape too thin to read                                                         | Softer, warmer shadows; lanterns along the gallery and the barrier at night, with short lamp shadows; heavier air on the cape so it opens                                                                                                                              |
| 4         | The crowd shot                                        | The salute faced shaded stands and the camera saw the bull's back in the foreground; hats too big                                                 | He salutes the sunlit stands, the bull far behind; smaller hats with crowns and bands; more flowers                                                                                                                                                                    |
| 5         | The crowd and shoulders shots                         | Seen from near the barrier, the stands' segments overlapped wrongly (stripes); the gate's arch drawn over the barrier; no way through the barrier | The bowl painted layer by layer, outside in, the order that holds from anywhere on the sand; a door left in the barrier at the gate; the gate's arch inside the bowl; evening light spilling through it onto the sand                                                  |
| 6         | Frame rate                                            | 43 fps (veronica) and 38 (crowd) at 1920 × 1080: the GPU, not the script, was saturated by thousands of draw calls                                | Each layer of the bowl filled as one path per colour; the frame and lettering cached; the sky, stands, crowd and sand cached in their own canvas, repainted when the camera moves or twelve times a second for the crowd; the cape drawn as cells instead of triangles |
| 7 (owner) | The owner: the exit looked like a wall, not a passage | The whole gate was one flat, glowing rectangle in the colour of the stands, the stone arch laid on it                                             | A masonry block fills the cut in the stands; through the arch runs a vaulted passage seven metres long, dark at the mouth, its stones catching more light towards the far end, where the evening (or darkness, with the gate shut) shows                               |

### Measurements

| Measure                                   | Result                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| Spectators                                | 3,600 to 3,800 seated, in a dozen looks, each sitting, standing, arms down, up or waving |
| Frame rate, 1920 × 1080, GPU (dev server) | Veronica 59 fps, crowd 60, shoulders 60; 2560 × 1440 veronica 57                         |
| Script time per frame                     | About 6 ms (the simulation about 1 ms of it)                                             |

### The title

A search for "Sol y Sombra" as a game title (stores, itch.io, board-game listings, general web) found no game of that name. The phrase names two films (Spanish, 1946; French, 2018) and many shops and bars; it is the everyday name of the two sides of any bullring. We keep it. The prompt asks for alternatives only if the name is taken, so none were searched.

### The original's author

Search results for _BASIC Computer Games_ (Creative Computing, 1978, ed. David Ahl) say _Bull_ was written by David Sweet of Dartmouth, modified by students at Lexington High School, and finally by Steve North of Creative Computing. The book page itself could not be fetched here; to be checked against the book before the Hall entry names an author.

## The game (stages 4 to 7)

### Between the passes

The motion prototype only passed the bull. An afternoon needs everything around the passes, built on the same rig (`lib/sol-y-sombra/rig/`):

| Beat | What the rig does |
|---|---|
| The paseo | The matador and his two men walk in from the great gate side by side, in step, capes over their arms, and bow to the presidency; then each goes to his place by the barrier |
| The bull enters | The bulls' door in the barrier opens; the bull bursts out at a gallop, curves round into the ring and stops to look for something to charge, turning on its hindquarters to keep facing whoever moves |
| The crews' work | Each man in turn runs out to a spot six and a half metres from the bull, chosen so the bull's run carries on across open sand, cites it and takes it past with an outside pass, then goes back to his place |
| A pass | The motion prototype's passes, now with the engine's outcome: a close call brings the bull's line in, a goring brings it in further and throws the matador two stumbling steps onto the sand |
| Down | He sits where the horn put him, leaning back on his hands, watching the bull. One man runs between them and draws the bull away with a pass of his own, on the side away from the matador; the other runs to the matador's side |
| Getting up | Weight forward over the feet, hands on the knees, up; a walk to where the cape fell, a bend to take it by one corner, up again with it, the other hand taking its corner, a turn to face the bull |
| Helped off | One man (two, if it is serious) runs to his side; they get him up with a hand under his arm and walk him slowly to the nearest stretch of barrier away from the bull, his arms over their shoulders, all three in step |
| The finish | A long, still profile, then the reach over the horns as the bull goes under the arm; when it works, the bull runs on a few strides, kneels in front, lets its hind end down and rests, head low |
| The salute, the bow | Turned to the stands in the sun (the stage scores every direction for lit stands and a camera clear of the bull) |
| The bull goes home | It gets up hind end first, as cattle do, and walks back out through its door at a steady trot |
| The lap of honour | Half the ring along the barrier, an arm raised and waving, the crew behind, flowers falling round him |

New pieces: `torero.ts` (a person with a cape, tassels and fringes; acts swapped with a half-second blend), `acts.ts`, `bullActs.ts`, a `rest` mood in `bull.ts` (front folds first, then the hind end; read backwards it is the hind-first way of rising), `planTrack` lifted out of the pass for any run, `bookRoute` for winding walks, and walks that start from where the feet will be once their booked steps are done (a helper booked from his old position had teleported back to it).

### The screens

- **The afternoon** is a sequence (`components/sol-y-sombra/play/afternoon.ts`): each choice goes to the engine, the stage plays the result and resolves a promise when the beat is over. Space cuts any beat to its end by running the ring unseen. Reduced motion does the same for the long walks.
- **The HUD** is printed cards laid inside the poster's window: the bull's bill with the crews' work, the crowd's meter, the cards, a stamped line after each pass, the verdict's dial. Every number on them comes from the engine's own odds functions.
- **The director** gives each beat one held shot; a camera spot beyond the barrier is pulled onto the sand (it had put the lens among the front rows, heads filling the picture).
- **Sound** is synthesised; the stage reports hooves, the snort, the closest moment and the cape's swish as events.

### Things that bit

- `[data-view]` and `[data-phase]` are taken by the Hall's and the shell's own CSS; a HUD that used them was hidden or misread. It uses `data-afternoon`.
- Container query units in a custom property resolved to zero height here; the poster's unit `--u` is set in pixels by the stage as it sizes the canvas.
- In development React starts effects twice; the first start of an afternoon carried on after the second had begun, and the two raced through the beats. Each run now has a number, and a step from an older run stops.
- "Play again" with the same `?seed=` didn't restart: the screen was keyed by the seed. It is keyed by a counter.
- A loosely held pin dragged a far corner of the cape across in one tick (28 m/s spikes when the swirl's free hand took hold again). A hand taking hold now gathers the cloth at most 1.2 cm per relaxation pass.

## The critique (stage 8)

| Round | Looked at | Found | Changed |
|---|---|---|---|
| 1 | An afternoon by keyboard, 1280 × 720, light | The HUD invisible; the first site walk filmed from among the crowd; the crews' card cut off at the bottom; the matador's name still stamped over the sky after the verdict; R not starting a new afternoon | The attribute renamed; the camera kept on the sand; the crews' work folded into the bull's bill, names only on short screens; the stamp cleared at the verdict; the screen keyed by a counter |
| 2 | The scenes between passes, in the lab (`/sol-y-sombra/lab?scene=`) | Helpers jumping back to old positions; a twenty-metre walk to the infirmary; the walk off filmed from behind; the salute filmed past the resting bull's back; the bull charging into the camera on its entrance; the crews' passes sending the bull into the barrier where the others stood; the crew dawdling after the paseo | Walks start from where the feet will be; the nearest barrier away from the bull; the camera beside and ahead of the walkers; the salute's direction scored for a clear camera and lit stands; the entrance's path and camera moved; citing spots with open sand beyond; a new walk drops the old plan |
| 3 | Whole afternoons, 1920 × 1080, light and dark | The verdict's crowd shot lost the salute's direction and framed the resting bull; the cards small on a big screen | The salute's direction kept for the verdict; the cards scaled from their own corners above 1700 px |

### Measurements

| Measure | Result |
|---|---|
| Frame rate, 1920 × 1080, GPU (dev server) | Menu 60 fps, paseo 60, a pass 59 (p95 16.7 ms) |
| An afternoon, start to results, skipping nothing | About two to four minutes for five passes; the paseo, the entrance and the crews' work about 45 s, each skippable |
| End-to-end tests | `tests/e2e/sol-y-sombra.spec.ts`, ten tests on a production build at port 3221 |

## Regression checks

`npm run check:sol-y-sombra` (`scripts/check-sol-y-sombra.ts`): the 1970s formulas against hand-worked values; the crews' draw shares (±2 points); the inversion in both formulas; the two kills identical in 2,000 paired games; more than one roll per verdict; every fatal goring still awarded; YES/NO and numbers read as BASIC reads them; waiting for pass seven kills 19.8% and dies 70.1% (±2 points); the cards' odds against the engine (within four standard errors); the verdict's odds against its roll (±1.5 points); each bot's serious-goring and shoulders rates inside their bands; every draw winnable (best bot ≥ 25% shoulders) and careful play seriously gored ≤ 15% in every draw; a seeded corrida repeatable.

`tests/unit/sol-y-sombra-engine.test.ts` (19 tests) covers the same rules case by case.

`tests/unit/sol-y-sombra-rig.test.ts` plays the loop for 40 s and locks: no planted foot or hoof slides (exactly 0); no matador joint jolts beyond 150 m/s²; the horns stay at least 20 cm off the trunk; the run is deterministic; no cape particle passes 25 m/s; a settled cloth keeps its links within 8 % of their rest length; IK meets every reachable target exactly and straightens smoothly beyond reach.

## Open questions

- The author and year of _Bull_: the listing carries only the Creative Computing header. To be settled from the book before the Hall entry.
- The outside pass asks for hands a little beyond the arms' reach at the end of its sweep (up to 27 cm); the arms simply straighten. If the owner wants the cape farther out, the matador should step away further rather than reach.
