# Progress

One row per game. Each session edits only its own row and its own polish list, once, at the end of its prompt.
This file is excluded from formatters (`.prettierignore`) so parallel sessions don't rewrite each other's lines.

| Game | id | Status | Docs | Achievements | Daily | Last prompt |
|---|---|---|---|---|---|---|
| Bop Box | `music` | Playable | 6 of 6 | 8 (4 common, 3 rare, 1 legendary) | None | 00 retrofit (2026-10-07) |
| Stickler | `23mtch` | Playable | 6 of 6 | 14 (7 common, 4 rare, 3 legendary) | Daily puzzle, numbered from 2026-01-01 | 00 retrofit (2026-10-07) |
| Outta Here | `escape` | Playable | 6 of 6 | 14 (7 common, 5 rare, 2 legendary) | Daily Escape, numbered from 2026-01-01 | Backlog BL-002 Copycat, BL-006 Mega bomb (2026-10-10) |
| Don't Crater | `lander` | Playable | 6 of 6 | 15 (7 common, 5 rare, 3 legendary) | Daily Drop, numbered from 2026-01-01 | 00 retrofit (2026-10-07) |
| Two Humps | `two-humps` | Playable | 6 of 6 | 15 (5 common, 7 rare, 3 legendary) | Daily Crossing, numbered from 2026-10-09 | 03 two-humps (2026-10-09) |
| Same Trick Twice | `long-memory` | Playable | 6 of 6 | 11 (5 common, 4 rare, 2 legendary) | Daily Endgame, numbered from 2026-10-09 | 09 long-memory (2026-10-09) |

## Polish candidates

Weaknesses noticed during the retrofit: in its screenshots (`docs/media/shots/`) and while the six docs of each
game were checked against the code. Prompt 00 was told not to redesign the games, so these are left for the polish
prompts. Items it did fix are not listed.

### Hall, Keyring and kit

- Wall at 1280×720: the "Next on the bench" tile for the game in design sits just below the fold; only its kicker shows.
- Orbit at 1280: the outlined "pick a world" headline runs behind the info panel.
- Device at 1280×720: the cartridge shelf starts below the fold (its label shows; the cartridges don't).
- Keyring with 20 or more keycaps: the caps bunch at the bottom of the ring and overlap; the spread could grow with
  the count.
- Today strip: with more than four dailies it will wrap to two rows; the Orbit stage assumes one row (`--today-h`).
- The shortcuts sheet lists only the keys a game passes in; Stickler, Outta Here and Don't Crater leave out some of
  theirs (see below).
- Games with their own CSS motion rules (Stickler) follow only the system setting; the kit's `data-motion` attribute
  could drive them too.
- `lucide-react` is still a dependency, but nothing imports it any more.
- Owner question: some game menus name the original or its machine in their own copy ("a 1980 program called
  ESCAPE", "TRS-80 · white phosphor", "first flown in 1979"). Rule 2 names the original only in the inspired-by line.

### Bop Box

- Studio at 1280: long tune names are cut with an ellipsis in the tune list ("Funeral March of a…").
- The key hint on the selected style card ("1" on Orchestra) almost disappears against the card's gradient.
- Hip-hop and Original Score have no accent colours of their own, so the page stays gold.
- In PC Speaker ’81, muting the "PC speaker" track greys it out but the square wave keeps sounding.
- How to play and Settings can't be opened from the studio (no pause menu); a help button in the studio would do it.
- Arrow keys on the view tabs and the 1981/Full switch move through bars instead of moving focus.
- The position slider reads out a time that ignores the speed setting.
- "Less motion" doesn't slow the scrolling score or the falling notes.
- Leftover "soon" and "No full version yet" labels: every tune has a full version now.
- The Long Version keycap can be earned by jumping to the last bar.
- Play counts are recorded but shown nowhere; the last tune and style aren't remembered between visits.
- Owner question: bring PC Speaker ’81 closer to the 1981 timing (Humoresque, Blue Danube, Sakura and the Mozart
  excerpt differ in length by 12–38 %).

### Stickler

- Top bar at 1280 during a round: the inspired-by line is cut ("People's Comput…"); a shorter form would fit.
- The "You win!" title on the results card is light orange on near-white; check it against AA for large text.
- An unfinished Daily isn't recorded, so leaving or restarting gives another try; Share on a practice replay uses the
  same "Daily #N" heading; a game menu left open past midnight still offers yesterday's Daily.
- The Sparky level and stick style pickers are radio groups that don't answer the arrow keys.
- "Solved today ✓" uses a typed check mark; the kit's SVG icon would match the rest.
- In 1981 mode the "4?" button doesn't unlock Rule Bender, though it is the same joke.
- The shortcuts sheet doesn't say that Space also strikes.
- "N hints" in the share text and the stars counts the deepest Coach step reached, not the presses.
- The share heading reads "Stickler Daily #N", while the kit's format is "Title · Daily #N" (kept so old shares match).

### Outta Here

- Run, first screen: the start hint ("Find your way to the +…") covers the bottom rows of the field, near the exit.
- 1980 mode at 1920×1080: the screen is very large, so the key legend under it falls below the fold.
- One action has five labels: "Again", "Try again", "Play again", "Start again", "Run it again".
- The game menu says "Badges" where the rest of the collection says keycaps.
- The shortcuts sheet leaves out comma and full stop, the menu letters, Enter for the next screen, and the Versus and
  1980 keys.
- Keycaps are awarded when a run ends, so R or leaving throws away an Under the Keys or Wraparound already earned.
- The Daily's first try is the first finished run; R or leaving before the end gives a fresh one.
- R and N restart a run at once, with no question, even deep into a Hard run.
- The warning squares for falling blocks differ by colour only; they could borrow the landed blocks' shapes.
- The Screens map has no address of its own: browser Back from it leaves for the Hall.
- The No Hesitation hint says "Normal or Hard", but the Daily counts too and Screens don't.
- Small tidies: Versus and 1980 mode don't skip keys typed into text fields; `stunnedUntil` and `resetProgress` are
  unused. (The duplicate comment in `Play.tsx` and Versus's "Bomb 1" on Chill were fixed with BL-002 and BL-006.)
- The Copycat is on Hard only (and Versus on Hard); whether it should reach Normal, the Daily or the Screens is the
  owner's call.
- Normal's bot band was raised from 55–85% to 55–90%: the Mega bomb lifts Normal from 80% to about 84–87%.

### Don't Crater

- Results panel at 1920: the three standard actions wrap, with Back to the Hall alone on a second row.
- Lobby: the sun and moon glyphs in the "light theme lands on the day side" note sit above the text, not beside it.
- N after a failed mission still opens the next mission, even a locked one.
- N after a named Free Flight site starts a random site, though no New site button shows.
- The shortcuts sheet leaves out U, S, F and X, Enter for Ten-Second, N, and R mid-flight.
- R mid-flight restarts at once, with no question, so a stray key can end a long descent.
- The flag designer says "5 km/h or less", but outside 1979 mode the flag goes up only under 5.
- With the Ten-Second slider focused, the digit, F and X keys do nothing.
- After Forget my data, the kept flag can still carry an emblem that is locked again.
- W and S move the throttle in Live but not in Free Flight, where S is the scan.

### Two Humps

- The seed sack's drop target is "left of the camel, low on the sand", not the jerboas themselves.
- On small portrait screens the HUD stacks over much of the scene; the game is designed for landscape.
- The rival's caravan is drawn further from you than it really is, so a close race still shows two caravans.
- 2560 × 1440 runs at 53–56 frames a second with a laptop GPU (60 at 1920 × 1080); without a GPU, 20–30.
- Keys pressed while a turn is still playing out are ignored rather than queued; the cards say "Wait" meanwhile.
- 1982 mode's `F1`–`F6` submit numbers, which the original's soft keys never did (they typed words).

### Same Trick Twice

- Owner question: Oware is a solved draw, so against perfect play no Oware table can be won; the Hard Scholar
  is strong but not perfect. Does "every table winnable" need more than that for Oware?
- The Daily Endgame uses only 1978 Awari and Kalah: Oware positions can repeat, which the exact solver can't
  prove its way through.
- With reduced motion on, seeds can't be carried by hand: a drag sows the pit when it is let go.
- Without WebGL2 only the 1970s terminal can be played; a flat Canvas 2D board would keep the rest playable.
- Without a graphics card the light board shows faceted pit rims and a toothed front edge; a mesh that is dense
  only around the pits would smooth them at little cost.
