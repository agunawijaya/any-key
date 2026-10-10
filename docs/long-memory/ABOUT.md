# Same Trick Twice: about the game

**Same Trick Twice** is a seed-sowing game on a carved wooden board, played against an opponent that keeps a book of
every game it fails to win. Beat it with a clever opening and it writes your trick down; play the same trick again
and it steers away from it, a little, then a little more. It is the Any Key rebuild of *Awari*, a learning program
from the 1970s, and it also plays two of the traditional mancala games the 1978 rules were loosely built on: Oware
and Kalah.

## The game

Twelve pits, two stores, a handful of glossy seeds in each pit. On your turn you lift every seed out of one of your
pits and sow them, one by one, into the pits that follow round the board. Where the last seed lands decides
everything: in your store, you move again; in an empty pit, you may take a whole pit of seeds across the board. The
seeds fly in little arcs and drop with a click; captures pour into the store in a stream. You can click a pit, press
1 to 6, or pick the seeds up with the mouse and drop them yourself, pit by pit.

Across the board sits the Learner. It thinks only one move ahead, exactly as the 1978 program did, and on its own it
is not hard to beat. But it remembers. Every game it doesn't win goes into a small brass-cornered book beside the
board. When a new game starts the way a lost one did, the book opens, a page glows, and a ghost of the old losing
move drifts over the board in blue light before the Learner turns away and plays something else.

How long does a trick last? Against a player who never changes, the 1978 Learner needed about ten lost games before
it found a reply that held. That is where the name comes from: you can fool it with the same trick twice, and
more, but not for ever.

## What's new

- **A book you can read**: the Learner's memory is a Memory Book with every lesson drawn on a small board, the day
  it was learned and the score. It stays between visits, unless you choose to have it forget, as in 1978.
- **Three rule sets**: the 1978 rules, Oware (the West African game, in its international Abapa form) and Kalah,
  against the Learner, the Scholar (a proper search opponent at three levels) or a friend on the same screen.
- **The Daily Endgame**: one position a day, the same for everyone, against a defender that never errs.
  "Win in 3", "win by 4". Every puzzle is checked by a solver before it is offered.
- **1970s mode**: the 1978 program on a terminal, turn for turn, with every quirk it had, up to the day its memory
  table runs out.
- **A board you can hold**: drag a pit's seeds and drop them yourself, one pit at a time.

The full list is in [CHANGES-FROM-ORIGINAL.md](CHANGES-FROM-ORIGINAL.md).

## The original

*Awari* is a BASIC program of seventy lines. The version we started from is the one in *BASIC Computer Games*
(Creative Computing, 1978), written for the Microsoft BASIC of the first home computers. You played on a printed
board of numbers against the computer, which learned from the openings of the games it lost and forgot everything
when the program stopped.

## Who made it

Geoff Wyvill of Bradford University, Bradford, Yorkshire, wrote it. The credit is printed in Digital Equipment
Corporation's *101 BASIC Computer Games* (we read the March 1975 printing), and later versions keep it. David H. Ahl
collected and edited both books.

## Where it went

From the DEC book to Creative Computing's microcomputer edition of 1978, then into countless home computers by
hand, one typed line at a time. Ports followed for many machines and, much later, for modern languages. Our copy is
the 1978 listing, `AWARI.BAS`.

## Facts and trivia

- The program remembered each lost game as **one number**: the first eight moves, both players', written in base 6.
- It had room for **51 lessons**. After the 51st game it failed to win, the next game could not start: the program
  stopped with an error. We checked this by running the original.
- It **meant to clear a running score** before weighing each move, and cleared a different variable instead. Its
  judgement drifts with whatever it last thought. Fixing the bug makes it learn worse against some opponents.
- In its rules a seed ending in an empty pit **on your opponent's side** captures the pit across, which is your own.
- Oware was **worked out completely** by computer in 2002: with perfect play on both sides, it is a draw.
- Kalah with four seeds a pit is a **win for the first player** with perfect play.

## Sources

- Digital Equipment Corporation, *101 BASIC Computer Games*, ed. David H. Ahl, 3rd printing, March 1975, pp. 19–21
  (the credit to Geoff Wyvill).
- David H. Ahl (ed.), *BASIC Computer Games*, Creative Computing, 1978 (the listing).
- John W. Romein and Henri E. Bal, "Solving the Game of Awari using Parallel Retrograde Analysis", *IEEE Computer*,
  October 2003, pp. 26–33 (Oware a draw).
- Wikipedia, *Kalah* and *Oware*, October 2026 (rules, names, Kalah(6,4) a first-player win, after M. Rawlings, 2015).
- Everything about the program's behaviour: its listing, and runs of it in PC-BASIC. See [NOTES.md](NOTES.md).
