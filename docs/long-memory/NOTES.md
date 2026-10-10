# Same Trick Twice: notes

The lab book: what we verified about the 1978 program, how, and the simulations behind the claims the game makes. Line numbers are the BASIC listing's. The listing stays outside the repository; everything here is in our own words.

## How we checked the original

We did not have to trust our reading. The listing runs unmodified in **PC-BASIC** (a GW-BASIC interpreter, installed outside the repo), and we used it in three ways:

1. **Self-playing copies.** A scratch copy of the program, kept outside the repository, with its keyboard input replaced by a random player and its board printing switched off, played 8 runs of 150 games. It logged every move the computer chose, its best score (D) and the leftover Q.
2. **The unmodified program, fed our moves.** A strong player (our Scholar's search) played our model of the program until the model ran out of memory. Its moves were typed into the unmodified original from a file, and everything the original printed was compared: 3 runs, 171 games.
3. **Odd inputs** (decimals, 0, 7, negative numbers) typed into the unmodified program.

Our model of the program (`lib/long-memory/original.ts`) matched every one of the **13,183 computer moves** recorded, with every best score, every leftover Q, every result and the crash. 2,826 of those moves ship as a fixture. `scripts/check-long-memory.ts` replays the fixture (`tests/fixtures/long-memory-1978.json`) on every check.

## Verified facts about the original

1. **Who wrote it.** The 1978 listing carries only the Creative Computing heading. The program is older: Digital Equipment's *101 BASIC Computer Games* (3rd printing, March 1975, pages 19–21) credits **Geoff Wyvill of Bradford University**, Bradford, Yorkshire. The 1978 *BASIC Computer Games* reprinted it for microcomputer BASIC. Later editions keep the credit to Wyvill.
2. **Board.** Six pits a side, three seeds in each (line 25), two stores, 36 seeds in all. The player always moves first. ✔ as the brief said.
3. **Sowing goes through every hole**, both stores included, and on a long sowing back through the pit it started from (lines 600–610). Your seeds can land in the computer's store. ✔
4. **One extra move, never two.** A last seed in your own store gives you one more move (lines 50 and 70). A second store landing in that extra move passes the turn. This holds for the computer too: it prints its two moves joined by a comma. ✔
5. **Captures on either side.** A last seed that lands in an empty pit (not a store) takes the pit straight across, if it has seeds, plus the capturing seed, into the mover's store (lines 615–625). It works on the opponent's side too, and then the pit across is **your own**: you "capture" your own seeds into your store. The brief said "either side"; the own-pit consequence is ours.
6. **The end.** The game stops as soon as either row of pits is empty (lines 205–235), after any move. Seeds left in the pits are not counted. Only the stores count. ✔
7. **The learning.** The first eight moves of a game, both players and extra moves included, are written into F(N) as base-6 digits (pit 1–6 → 0–5, line 210). When the computer does not win (a draw counts), N goes up by one and that record is kept (line 90). A win is forgotten: the next game reuses the slot. While weighing a pit during the first eight moves (line 850), the computer takes **2 points off for every remembered game** whose opening matches the game so far plus that pit (lines 855–870). ✔
8. **The evaluation** (lines 810–850): for each non-empty pit it plays the move on a copy of the board. It takes its store minus yours, then subtracts the best capture you could answer with. Your answers are judged roughly, on the board as it stands: for each of your pits, where its last seed would land, plus 1 if the sowing would wrap past the computer's store. Ties go to the higher-numbered pit (line 880 uses `>=`). ✔ one move deep, as the brief said.
9. **Q is never cleared.** Line 815 sets `G=0` where the next lines use Q. Q is never reset: not between candidate pits, not between turns, not between games. Every pit's "best answer" starts from the previous pit's final score, penalties included. The recordings confirm this to the unit: the leftover Q matched every time. See *Simulations* for what it does to the play.
10. **A is never reset either.** If no pit scores above −99 (line 880), the computer plays whatever it chose last time, whether or not that pit has seeds. It cannot happen in play: it would need many remembered games matching every pit at once. We model it, and never saw it.
11. **The table holds 51 games, then the program stops.** F is dimensioned to 50 (indices 0–50). After the **51st** game the computer does not win, the next game starts and line 30 writes F(51). The program halts with a subscript error at line 30, before the board is drawn. The brief said "about 50". Confirmed in PC-BASIC in all three strong runs, right after the 51st lesson.
12. **Forgetting.** Nothing is saved: the memory lives in variables and is gone when the program stops (or crashes).
13. **The digit trick.** The computer names its move with `CHR$(42+M)`: pits 7–12 print as the characters 1–6, counted from its own left. ✔
14. **Line 900** prints the first N board cells, not the memory. Nothing jumps to it: it is a leftover debugging line. ✔ by reading.
15. **The FOR loop that never should run.** Before the first lesson (N = 0), the memory search is `FOR I=0 TO -1`. Microsoft BASIC of the 1970s runs a FOR body at least once (the Altair BASIC manual says so); GW-BASIC skips it, and we checked that in PC-BASIC. Run once, the loop compares the game against F(0): with N = 0 that is the **current game itself**. It then penalises the computer's first pit whenever every move so far was a first pit, and at the ninth move always. In 3,000 simulated first games against random players, 256 (8.5%) play differently under the two rules. The 1978 book was written for Microsoft BASIC, so our 1978 Learner runs the loop once. The recordings come from GW-BASIC, so the replay uses the skipping rule.
16. **The ninth move.** The memory is consulted while C ≤ 8 (line 850), but only eight moves are stored. At C = 8 the comparison reads the stored game times six. A remembered game that matches all eight moves so far therefore always penalises the computer's first pit (it prints as "1") at the ninth move.
17. **The +.1.** The memory test is `INT(F(I)/6^(7-C)+.1)`: the .1 is meant to absorb rounding in `^`. It also rounds up a real prefix whenever the stored moves that follow are large enough. Two moves left: the next was a sixth pit and the one after a fourth, fifth or sixth. Three or more: anything at 90% or more of the range. The prefix then reads one higher, so the computer is warned off the pit **next to** the one it lost with. Over the lessons of a 400-game simulation, about 5% of prefix reads were off by one like this.
18. **Typed numbers.** Anything not between 1 and 6, or an empty pit, gets a short refusal followed by the *extra-move* prompt (line 120 goes to line 100). A decimal is accepted. In PC-BASIC, typing 2.5 plays the third pit (GW-BASIC rounds array subscripts) and records 1.5 into the memory number, which corrupts that game's record. Microsoft BASIC of 1978 may truncate instead; we have not run it.
19. **The last board twice.** When your move empties the computer's row, the check at lines 230–235 falls through into the board printer (line 500), and line 150 prints the board again. Seen twice in 57 games of a recorded run. ✔
20. **The name.** Oware is the Akan (Twi) name of the West African game, widely held to be of Ashanti origin. Related names include *awalé*, *wari* and *warri*, and *Awari* is the English name used in the computer-science literature (Romein and Bal titled their 2002 paper with it). The 1978 rules (stores in the sowing loop, an extra move, captures across the board, three seeds) are not Oware's. They are closer to **Kalah**, the game William Julius Champion Jr. patented and sold in the United States in the 1950s. The DEC book itself notes that a Kalah version was also submitted. Sources: Wikipedia's *Oware* and *Kalah* articles (October 2026); the DEC printing above.

## Quirks and bugs, and what the game does with them

| Quirk | In 1978 | In Same Trick Twice |
|---|---|---|
| Q never cleared (9) | Every judgement leans on the last one | The Learner keeps it, faithfully. The Scholar is a clean search |
| A never reset (10) | Unreachable in play | Kept in the model; the game never reaches it |
| The 51-game table (11) | The program halts | The Learner's book has no limit. 1970s mode shows a playful version of the error screen after 51 lessons in one session (the secret keycap *Subscript*) |
| Forgetting (12) | Gone at the end of a run | The book is kept in the player's save; a setting brings back "as in 1978" (wiped when you leave) |
| Captures your own pit (5) | Yes | Kept in 1978 Awari; Kalah and Oware capture as their own rules say |
| FOR loop runs once (15) | Depends on the machine | Microsoft rule in the game; both rules in the check |
| The ninth move, the +.1 (16, 17) | Yes | Kept, faithfully: they are the Learner |
| Decimals (18) | Accepted | Pits are buttons and keys 1–6. 1970s mode accepts decimals and rounds them the GW-BASIC way |
| Board printed twice (19) | Yes | 1970s mode keeps it |

## Simulations

All with our model of the program (`lib/long-memory/original.ts`), which matches the recordings move for move. The Learner runs the 1978 rule for FOR loops unless a line says otherwise. "Wins" are the computer's.

### Does it learn?

**Against a fixed opponent**, it changes its play game after game, but slowly. A fixed two-move search (our Scholar at depth 2) beat it **ten games in a row**. From the second game on, its third move changed every game: pits 12, 11, 10, 9, 8, 8, 8, 8 (its own numbering 7–12). Each memory of a loss costs a reply only 2 points, so it walks through its options. In the ninth game it went back to the reply it had lost with first, because the others had piled up more penalties. In game 11 it found a line the search could not beat, and won every game after that (the search repeats itself). Against a six-move search it took 15 losses.

| Opponent | Before it found a winning line | After |
|---|---|---|
| Fixed two-move search | 10 losses | won all of games 11–30 |
| Fixed three-move search | 10 losses | won all after |
| Fixed four-move search | 3 losses | won all after |
| Fixed six-move search | 15 losses | won all after |
| Greedy (takes the biggest gain now) | never lost | — |

So the brief's "it will not fall for the same trick twice" is not what the program does: a trick works until about ten lessons pile up against it. The game is named after that.

**Against a slightly unpredictable strong player** (three-move search, a random move one time in ten): it wins 38%, 31%, 46% and 46% of games 1–25, 26–50, 51–75 and 76–100. A modest rise. In **every one of 20 runs** the program reached its 51st lesson and stopped, between games 63 and 108 (median 84).

**Against random moves** it wins **96.2%** of 4,000 games (40 runs of 100), and the rate does not move with experience. Random players rarely repeat an opening, so the memory has nothing to recognise. At that rate the table fills after roughly 1,200 games.

**How often memory changes a move:** against a mix of random, greedy and searching players, in 11.3% of the computer's decisions (214 of 1,889).

### The Q bug: as written against as meant

Clearing Q before each pit, as the author meant, barely changes the results against random players (96.6% against 96.1% as written, 8,000 games each). Against fixed searchers it changes which lessons stick. With Q cleared, a fixed four-move search **beats or draws it until the table runs out**: 35 losses and 16 draws, then the crash. As written, it learns that opponent in three games. The bug makes its judgement wobble, and against a fixed opponent the wobble helps it escape a loop.

### The Scholar

Negamax with alpha-beta, a transposition table and iterative deepening, bounded by nodes (Easy 4,000 at depth 2 with noise, Normal 60,000 at depth 6, Hard 300,000 at up to depth 16). At the opening position Hard reaches depth 13 in 1978 Awari, 12 in Kalah and 11 in Oware, in 0.3–0.5 s (Node, one core). Normal beats Easy 10–1 (1978 Awari), 11–0 (Kalah) and 12–0 (Oware) over 12 games each, sides alternating. Hard against Normal (10 games each, `--full`): 10–0 in 1978 Awari, 7–2 in Kalah, 10–0 in Oware. Normal against Easy over 40 games: 36–3, 38–1, 40–0.

### Can every game be won?

- **Against the Learner** (1978 Awari, you move first): yes. A three-move search wins most early games.
- **Kalah, you move first:** Kalah(6,4) is a proven win for the first player, by 8 with perfect play (Rawlings 2015, via Wikipedia's *Kalah*), and so is Kalah(6,5). Against any opponent, the player who opens can win. We keep the player opening against the Scholar.
- **Oware:** with perfect play from both sides it is a draw (Romein and Bal, 2002). No setup can make it a forced win for the player without changing the game. The Scholar is not perfect: Hard looks about 11 moves ahead and can be beaten. This is the one place the owner's "every table winnable" rule needs a decision: see *Open questions*.
- **The Daily Endgame:** every puzzle is checked by an exact solver. The goal can be reached with best play, at most half the first moves reach it, and at least one first move throws the win away.

### The Daily Endgame

Days alternate between 1978 Awari and Kalah, and in pairs between "win in N" (N = 2–5 of your sowings) and "win by K". Each is a position from a game the computer plays against itself from the day's seed, stopped when 7 to 11 seeds are left with the player to move. Built in the browser, in a worker: about 0.2 s on average, 3.4 s on the slowest day of the first year (Node). On the rare day neither the day's goal nor its rule set yields a fair puzzle, the other goal and then the other rule set are tried, in a fixed order, so every player still gets the same one: over the first year, 177 "win in N" and 188 "win by K".

## Performance

Measured on 2026-10-10 with a production build at 1280 × 720, in Chromium driven by Playwright: once with an
RTX 4060 laptop GPU (ANGLE on Direct3D 11), once with no GPU (SwiftShader, which draws WebGL on the processor).

| | GPU | No GPU, before the light level | No GPU, light level |
|---|---|---|---|
| Game menu, board playing itself | 60 fps | 0.7 fps, frames up to 2.2 s | 54–57 fps (moves land at once) |
| Waiting for your move | 60 fps | 0.7 fps | 60 fps (nothing redrawn) |
| Seeds moving | 60 fps | under 1 fps | 10–12 fps |
| One sowing, key to landed | 2.4 s | | 2.8 s |
| Esc to the pause menu | 0.03 s | | 0.2–0.25 s |
| Esc on the menu to the Hall | 0.04 s | 22 s | 0.04 s |
| First visit until the page answers | 0.56 s (was 2.2 s before the shaders compiled in the background) | 9 s | 1.1 s |

The full board at 1920 × 1080 also holds 60 fps on the same GPU.

## Regression checks

| Check | Locks | Tolerance |
|---|---|---|
| `scripts/check-long-memory.ts`: rules | Six to seven hand-worked positions per rule set: sowing, stores, extra turns, captures, grand slam, feeding, endings, sweeps | Exact |
| …: the original | 3 strong runs (moves, results, crash at line 30 after the 51st lesson) and 150 random games (choice, best score, leftover Q) from PC-BASIC | Exact |
| …: the Learner | The game's Learner makes the 1978 module's moves for 12 games; first turns away in game 2; the third-move sequence above; ten lessons of eight moves | Exact |
| …: learning | Ten losses then twenty wins against a fixed two-move search; Q cleared never learns a four-move search before the crash; 93–99% against random players | Exact, and the range |
| …: Scholar | Legal moves only; Normal beats Easy in every rule set (Hard beats Normal with `--full`) | Majority |
| …: dailies | 45 days (365 with `--full`): goal, answers and losability re-checked by a fresh solver; share text; built in under 6 s | Exact |

## Open questions

1. **Oware and "every table winnable".** Oware is a theoretical draw. We can offer it as is (the Scholar is beatable but not provably), or let the Scholar make one deliberate mistake on Hard. Owner's call.
2. **Microsoft BASIC and decimals.** Whether the 1978 interpreter truncated or rounded a decimal subscript (fact 18) needs a run on a Microsoft 8K BASIC, which we have not done.
3. **The first printing.** We saw the March 1975 printing of the DEC book; the first printing (1973) should carry the same credit, but we have not seen it.
