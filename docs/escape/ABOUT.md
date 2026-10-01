# Escape (ESCAPE.BAS): About the Original Program

This document covers *Escape* (`escape.bas`), a tiny TRS-80 game that Any Key rebuilds as **Outta Here**. It explains what the program is, what little we can say about who wrote it and when, the machine it was written for, how our copy reached us, and the bugs that make it interesting. For playing the original, see [HOW-TO.md](HOW-TO.md). For a walk through its eleven lines, see [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md).

This project does not reproduce the listing. The docs describe it in our own words; the only text the program ever shows is its one-word title.

## What the program is

*Escape* is a one-player action game in **eleven lines of BASIC** (408 bytes). It clears the screen and prints its title in the top-left corner. Your piece, an asterisk, appears on the first letter of that title, so the screen reads `*SCAPE`. A plus sign on the bottom row is the exit. Four keys move the asterisk: comma and full stop for left and right, and the up and down arrows.

The catch: **whenever you are not pressing a key, a solid block appears somewhere on the screen.** The program does nothing else while it waits, so blocks arrive dozens of times a second. Hesitate and the screen fills up around you; keep pressing keys and it stays clear. Reach the plus and the program simply stops.

There is no score, no timer, no message when you win, and no way to lose. The game is the race between your fingers and the blocks.

## Who wrote it, and when

We don't know. The file has no name, credit, date or comment in it, and searches of the published type-in collections and archives we could reach in 2026 found no listing that matches it. It may have been typed in from a magazine or book we couldn't find, passed around on a disk or tape, or written by someone for themselves.

We file it as **c. 1980**, a best guess from what the program needs:

- It uses `INKEY$`, `PEEK`, `POKE` and `ELSE`, so it needs **Level II BASIC**, which Radio Shack introduced for the TRS-80 Model I in 1978. The earlier Level I BASIC could not run it.
- It writes straight into the TRS-80's video memory at address 15360 and relies on the keyboard's memory sitting just below it. That layout is the **Model I's** (1977) and the **Model III's** (1980). It would not work on other machines, or on the later Model 4 in its own mode.
- Its style, every space squeezed out to save memory, is typical of hobbyists working in 4K or 16K of RAM at the turn of the decade.

So it could be from anywhere between 1978 and the early 1980s. The Hall shows the year as "c. 1980" for that reason.

## The machine: a TRS-80

Tandy's Radio Shack stores launched the TRS-80 Model I in August 1977, one of the three ready-made home computers of that year. It had a Zilog Z80 processor at 1.77 MHz and showed **64 columns by 16 lines** of text on a modified black-and-white television, white on black. There was no colour.

Three facts about it explain the whole program:

| What | Where | Why it matters here |
|---|---|---|
| The screen | 1,024 bytes of memory from address 15360 (3C00 hex) to 16383, one byte per character cell, row by row | Writing a byte with `POKE` puts a character on the screen; reading one with `PEEK` tells you what is there. The game uses the screen as its only board |
| The keyboard | Memory-mapped just below the screen, from 14336 (3800 hex) | Writing there does nothing, and nothing shows. The program never meant to go there, but it can |
| BASIC's working memory | Starts right after the screen, at 16384 (4000 hex), with jump addresses that BASIC itself uses all the time | Writing a character there breaks BASIC. The program can do that too |

The TRS-80's characters 128 to 191 are block graphics: each cell is split into a 2 × 3 grid of "pixels", and the character code says which are lit. **Code 191 lights all six**, a solid block the size of a letter. That is the program's only wall.

## How our copy reached us

Our `escape.bas` is plain text: eleven lines with PC (CR LF) line endings and no tokenizing, so it was saved or converted as a text listing, not as a TRS-80 program file.

One detail shows that this exact copy is not the one that ran. On the TRS-80, the down-arrow key types a **line feed** character. The program checks for it by comparing the key against a string with a line feed inside the quotes, which a TRS-80 user could type directly: pressing the down arrow while entering a line starts a new screen line *without* ending the program line. In our copy that character has become a full line break (CR LF), so line 80 now looks like two lines. Loaded as it is, BASIC would cut line 80 short at the opening quote. Somewhere on its way to us, through a printed listing or a line-ending conversion, the line feed turned into a new line. We don't know which.

## The bugs that make it

Most of what is interesting about *Escape* comes from four short checks, three of which are wrong. ORIGINAL-ARCHITECTURE.md has the details; in brief:

- **Rows wrap.** Because the star is just an address and a step left or right is one byte, walking off the right end of a row puts you at the start of the next row, and walking off the left end puts you at the end of the row above.
- **You can't step right from the very first cell.** The check that should stop you at the right edge was copied from the left-edge check and tests the top-left address instead.
- **You can walk off the top of the screen.** The up check compares against an address a row *above* the screen, which the star can never be at, so it never stops you. One step up from the top row puts the star in the keyboard's memory, where writing does nothing: the star vanishes. One more step up goes deeper; a third is finally refused. Walk back down and you reappear.
- **You can crash the computer.** The down check lets you step down from the bottom-left corner, and nothing stops a step right from the bottom-right corner. Either way the star is written to address 16384, over the jumps BASIC depends on. The program cannot carry on after that; the machine almost certainly froze or restarted.

Two smaller quirks:

- Blocks can land on the star. When one does, the star disappears under it, and any key at all (even one the game doesn't use) wipes the block away as the star is redrawn.
- The random number only reaches as far as the bottom row's first cell, so **the bottom row stays clear** except for that one cell, and the exit is never covered.

## Facts and trivia

- **No win, no loss.** Reaching the exit just ends the program, leaving BASIC's `READY` prompt under the title. Getting boxed in doesn't end it either: you can only press BREAK.
- **The faster you type, the drier it stays.** A block falls each time round the loop when no key is waiting. A key press costs the rain one block.
- **No key repeat.** The TRS-80's `INKEY$` reports a key once when it goes down. Holding a key moves you one step.
- **The arrows half work.** The program reads the up and down arrows, but uses comma and full stop for left and right. The TRS-80's left and right arrows do nothing.
- **The title is the first casualty.** The star starts on the E of the title, and any block can land on the remaining letters.
- **It is fast.** We estimate the loop at about sixty times a second, so a second of hesitation drops about sixty blocks on a screen of 960 cells (see ORIGINAL-ARCHITECTURE.md for how we got that number).

## Sources

- Radio Shack, *TRS-80 Level II BASIC Reference Manual* (1978): `INKEY$`, `PEEK`, `POKE`, `RND(n)`, `IF … THEN … ELSE`, graphics characters.
- Radio Shack, *TRS-80 Model III Operation and BASIC Language Reference Manual* (1980): the same video and keyboard memory layout on the Model III.
- Radio Shack, *TRS-80 Microcomputer Technical Reference Handbook* (Model I): the memory map (keyboard at 3800 hex, video at 3C00 hex, RAM from 4000 hex) and the keyboard's codes for the arrow keys.
- Our own reading of `escape.bas` and a byte-by-byte look at the file (408 bytes, CR LF line endings, the line feed inside line 80).
- Unverified: the program's author, date, and where it was first published, if anywhere.
