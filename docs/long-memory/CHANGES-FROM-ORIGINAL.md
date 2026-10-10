# Same Trick Twice: changes from the original

The soul we kept is the opponent: a plain one-move thinker that remembers every game it fails to win and steers away
from those openings next time. It thinks exactly as the 1978 program did, quirks and all.

## Kept

| In the original | In Same Trick Twice |
|---|---|
| The 1978 rules: three seeds, both stores in the loop, one extra move, captures across from an empty pit on either side, no sweep at the end | The 1978 Awari rule set, exactly |
| The computer's choice: one move deep, its store minus yours minus your best capture, ties to the higher pit | The Learner, move for move: checked against the original on 13,183 of its moves |
| The memory: the first eight moves of every game it doesn't win, two points off a move that would repeat one | The Learner's book, the same numbers in the same comparisons |
| The leftover Q, the ninth-move slip, the +.1 rounding | Kept in the Learner; they are part of how it plays |
| You always sow first | You always sow first against the computer |

## Changed

| In the original | In Same Trick Twice | Why |
|---|---|---|
| The memory vanished when the program stopped | The book is saved in the browser; "as in 1978" brings the forgetting back | A learning opponent you can come back to is the point of the game |
| The table held 51 games, then the program stopped | No limit | Losing your opponent's memory to a crash is not fun; 1970s mode keeps the crash, as a joke |
| A board of numbers | A carved board in 3D: seeds that fly, settle and click | To see the seeds move is to understand sowing |
| You typed a pit number | Click, keys 1–6, or drag the seeds by hand | Every way of picking a pit, including the one you would use at a real board |
| Learning was invisible | The book opens, a page glows, and the remembered move drifts over the board | The best thing about the program was hidden; now you can watch it think |
| Bad input: an error and the extra-move prompt | Pits that can't be sown can't be pressed | No typing, no typos; the terminal keeps the original's way |

## Added

- **Oware** (Abapa rules) and **Kalah**, the traditional games the 1978 rules borrow from.
- **The Scholar**, a search opponent at three levels, for all three rule sets.
- **Two players** on one screen.
- **Move preview**: where a pit's seeds will go, captures and extra moves marked.
- **The Memory Book**: every lesson on a small board with its date and score; wipe it when you like.
- **The Daily Endgame**, checked by an exact solver, with a share card.
- **1970s mode**, the original program's decisions on a terminal.
- **Eleven keycaps** in the Keyring, rules cards, records, settings, sound, light and dark.

## Left out

- Nothing of the rules. The program's printed words are not reused anywhere: every line on screen, the terminal's
  included, is our own.
- The debugging line 900, which nothing reaches.

## Faithful modes

**The Learner** is the 1978 decision procedure itself (`lib/long-memory/original.ts`), replayed against recordings
of the original running in PC-BASIC. Its book differs only in being kept and unlimited.

**1970s mode** runs the same model turn for turn: the same moves, the leftover Q and A, the ninth-move slip, the
+.1, one extra move at most, the computer naming its pits 1–6 from its own left, a refused move followed by the
extra-move question, a decimal accepted, the last board printed twice when your move empties the computer's row,
and, after the 51st game it fails to win in a session, the error that stopped the original. Where we had to choose:

- FOR loops run once even when they shouldn't, as in 1970s Microsoft BASIC (GW-BASIC skips them). This changes some
  first games of a session.
- A typed decimal sows the nearest pit, the way GW-BASIC rounds; a 1978 interpreter may have truncated it instead.
- The words, the board layout and the error screen are ours.
