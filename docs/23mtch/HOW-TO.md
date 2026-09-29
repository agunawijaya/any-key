# 23 Matches (23MTCH): How to Play the Original

This guide explains how to run and play the original 1970s *23 Matches* program (`23mtch.bas`), which Any Key is rebuilding as **Stickler**. It covers getting the program running today, what appears on screen, what the game accepts and rejects, how games end, how to stop the program, and how to win every time.

For background see [ABOUT.md](ABOUT.md). For line-by-line internals see [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md).

## The rules in one paragraph

A pile starts with 23 matches. You and the computer take turns, and on each turn you must take 1, 2 or 3 matches. **Whoever takes the last match loses.** You always move first.

## Running it today

`23mtch.bas` is a **tokenized** GW-BASIC file. Its first byte is `FF`, keywords are stored as one- or two-byte codes, and line numbers and constants are stored in binary. A text editor, or DOS `TYPE`, shows mostly junk. You have to `LOAD` or run the file in a GW-BASIC-compatible interpreter. You can also convert it to plain text first, as described below.

### Option 1: PC-BASIC (recommended)

PC-BASIC is a free, cross-platform interpreter that emulates GW-BASIC, BASICA, PCjr Cartridge BASIC and Tandy 1000 GW-BASIC.

1. Install it with a desktop installer from the project's GitHub releases page, or run `pip3 install pcbasic`.
2. Run the game directly:
   ```
   pcbasic --run=23MTCH.BAS
   ```
   Or start PC-BASIC and type `LOAD "23MTCH"` and then `RUN`.
3. To read the program as text:
   ```
   pcbasic --convert=A 23MTCH.BAS 23MTCH.TXT
   ```
   Or load it and type `LIST`.

By default PC-BASIC treats **Ctrl+C** like Ctrl+Break, which helps on keyboards that have no Break key.

### Option 2: DOSBox with GW-BASIC

1. You need `GWBASIC.EXE`. Microsoft published the 1983 GW-BASIC source code under the MIT licence in 2020, but the repository has no binaries and no build scripts. Use a copy that came with MS-DOS software you are licensed to use.
2. Put `GWBASIC.EXE` and `23MTCH.BAS` in one folder, for example `C:\RETRO`, and mount it in DOSBox:
   ```
   MOUNT C C:\RETRO
   C:
   GWBASIC 23MTCH
   ```
   If you give GW-BASIC a file name on its command line, it loads the file and runs it as if you had typed `RUN`. It adds `.BAS` when you leave out the extension.

### Option 3: PCjs in a web browser

PCjs emulates IBM PCs in the browser, with PC DOS and IBM's own BASIC and BASICA. Note that this is **not** GW-BASIC. To use the file, put it on a floppy disk image (PCjs's DiskImage tool can build an image from a folder), load the image into the virtual machine's drive, start `BASICA`, then type `LOAD "23MTCH"` and `RUN`. If BASICA will not accept the tokenized file, convert it to plain text with PC-BASIC first, because BASICA can also load plain-text programs. We have **not tested** this route. How IBM BASICA handles `RND(0)` is also **unverified**, so the computer's move when it is losing may differ from GW-BASIC's (see below).

## What you will see

1. **The rules.** Six lines restate the rules and end with a joke that the best computer may win "(HA HA)". They appear only once per `RUN`.
2. **The count.** For example, `THERE ARE NOW 23 MATCHES.` (It still says "MATCHES" when there is only one.)
3. **The prompt.** `HOW MANY DO YOU TAKE?` The question mark and the space after it come from BASIC's `INPUT`. Type a number and press Enter.
4. **The computer's reply.** It appears on one line with the next count, and then you are prompted again:

```
I TOOK 1 ...THERE ARE NOW 20 MATCHES.

HOW MANY DO YOU TAKE?
```

The computer answers immediately. There is no delay and no "thinking" message.

## What you may type

| You type | Result |
|---|---|
| `1`, `2` or `3`, not more than the matches left | Accepted |
| A whole number written with a decimal point, such as `2.0` | Accepted as 2 |
| More than the matches left, such as `3` when 2 remain | "Cheating" message |
| A fraction, such as `1.5` | "Cheating" message |
| `0`, a negative number, or just Enter (PC-BASIC, following GW-BASIC, reads an empty answer as 0) | "Cheating" message |
| `4` or more | "Cheating" message |
| Letters or other non-numbers | Not checked by the game. BASIC's `INPUT` prints `?Redo from start` and shows a bare `?` prompt. Type a number. |

The program applies its checks in this order: more than the pile, not a whole number, zero or less, four or more. With one match left, the only legal move is 1, and it loses.

## "Cheating"

The program treats every rule-breaking number as cheating. It prints a short accusation ("YOU CHEATED!"), promises another chance, and asks again. Nothing else happens: you lose no turn, there is no penalty, the count is not shown again, and you can "cheat" as often as you like. DEC's own sample run shows a player typing 0 and getting the message.

## How a game ends and restarts

- **You take the last match.** The computer prints its victory message ("I WON!!!").
- **You leave exactly one match.** The computer concedes at once without taking it, and prints a grudging "O.K. SO YOU WON."

In both cases a new game begins immediately at 23 matches, and you move first again. The rules are not shown again. There is no score, no tally of wins and no replay prompt.

## How to quit

There is **no quit command**. The program loops forever, and its `END` statement at line 999 is never reached.

- Press **Ctrl+Break**. At the prompt, GW-BASIC's line editor also accepts **Ctrl+C**. BASIC prints a Break message that names the line it stopped on (usually the `INPUT` line, 230), followed by `Ok`.
- At `Ok`, type `SYSTEM` to leave GW-BASIC and return to DOS, or type `RUN` to start again with the rules.
- In PC-BASIC, Ctrl+C works by default. You can also close the window.

## How to win every time

The player to move **loses** from 1, 5, 9, 13, 17 or 21 matches: numbers that are one more than a multiple of 4. Your aim is to leave the computer on one of these "magic" numbers after each of your moves.

1. **First move: take 2.** That turns 23 into 21.
2. **After that, take 4 minus whatever the computer just took.**

| Computer took | You take |
|---|---|
| 1 | 3 |
| 2 | 2 |
| 3 | 1 |

Each round then removes exactly 4 matches, so after your moves the pile goes 21, 17, 13, 9, 5, 1. When the computer faces the last match, it concedes.

**Why it works.** From 1 the player to move must take the last match. From 5, any move leaves 2, 3 or 4, and from those you can always leave exactly 1. The same argument repeats every four matches up to 21.

**One slip loses.** If you ever leave a number that is not magic, the computer moves to a magic number itself. From then on it plays perfectly and you will end up taking the last match. For example, if you open by taking 1, 22 remain, the computer takes 1, and now you are the one facing 21.

**On a PC the game is fully predictable.** In GW-BASIC (and PC-BASIC), the computer always takes exactly **1** whenever it is losing, because its "random" choice uses `RND(0)`, which never changes in this program. A perfect game therefore always goes like this:

| You take | Left | Computer takes | Left |
|---|---|---|---|
| 2 | 21 | 1 | 20 |
| 3 | 17 | 1 | 16 |
| 3 | 13 | 1 | 12 |
| 3 | 9 | 1 | 8 |
| 3 | 5 | 1 | 4 |
| 3 | 1 | concedes | 1 |

On the original DEC systems, the losing computer's takes varied between 1 and 3. The strategy is the same either way: answer each take with 4 minus it.

## Sources

- PC-BASIC README (installation, supported dialects): https://github.com/robhagemans/pcbasic
- PC-BASIC documentation source (running, converting, Ctrl+Break and Ctrl+C): https://github.com/robhagemans/pcbasic/blob/master/docs/source/documentation.html and https://github.com/robhagemans/pcbasic/blob/master/docs/source/options.html
- PC-BASIC `INPUT` implementation (empty answer becomes 0, `?Redo from start`): https://github.com/robhagemans/pcbasic/blob/master/pcbasic/basic/implementation.py
- GW-BASIC User's Guide, Chapter 2 (command line, `SYSTEM`), Chapter 4 (Ctrl+Break and Ctrl+C), `INPUT`, `LOAD`, `SAVE`: http://www.antonis.de/qbebooks/gwbasman/Chapter%202.html, http://www.antonis.de/qbebooks/gwbasman/Chapter%204.html, http://www.antonis.de/qbebooks/gwbasman/input.html, http://www.antonis.de/qbebooks/gwbasman/load.html, http://www.antonis.de/qbebooks/gwbasman/save.html
- Microsoft GW-BASIC repository (MIT licence, no binaries): https://github.com/microsoft/GW-BASIC and https://devblogs.microsoft.com/commandline/microsoft-open-sources-gw-basic/
- DOSBox wiki, `MOUNT`: https://www.dosbox.com/wiki/MOUNT
- PCjs, IBM PC DOS 1.00 BASIC programs: https://www.pcjs.org/software/pcx86/app/ibm/basic/1.00/
- PCjs DiskImage utility: https://www.pcjs.org/tools/diskimage/
- *101 BASIC Computer Games*, DEC, March 1975 printing (strategy write-up, sample run): https://archive.org/stream/bitsavers_decBooks10Mar75_26006648/101_BASIC_Computer_Games_Mar75_djvu.txt
- Wikipedia, "Nim" (misère subtraction game rule): https://en.wikipedia.org/wiki/Nim
