# Escape (ESCAPE.BAS): How to Play the Original

This is a guide to playing *Escape* the way it ran on a TRS-80 around 1980. For the program's background, see [ABOUT.md](ABOUT.md); for how it works line by line, see [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md). Outta Here's **1980 mode** plays it for you in the browser, quirks included (see the end of this page).

## The rules in one paragraph

You are the asterisk in the top-left corner. Get it to the plus sign on the bottom row. Every moment you are not pressing a key, a solid block appears somewhere on the screen, and you can't walk through blocks. There is nothing else: no score, no time limit, no enemies, no way to lose except getting stuck.

## Running it today

You need a **TRS-80 Model I or Model III with Level II BASIC**, or an emulator of one. Several free emulators exist, some of them in the browser; trs80gp is one that runs on a desktop. The program does not run in PC BASICs such as GW-BASIC, because it draws by writing to the TRS-80's video memory.

1. Start the emulator in Level II BASIC (Model I) or BASIC (Model III).
2. Type the program in, or paste it if the emulator allows.
3. **Fix line 80.** In our copy, the down-arrow character inside line 80's quotes has turned into a line break, so the line arrives in two pieces (see ABOUT.md). Retype line 80 on the TRS-80 itself, and when you reach the inside of the quotes press the **down arrow** once: on the TRS-80 that types a line feed into the line without ending it. Then finish the line and press ENTER.
4. Type `RUN` and press ENTER.

## What you will see

The screen clears. The word ESCAPE appears in the top-left corner, and at once its E turns into an asterisk: that's you. A plus sign appears in the middle of the bottom row. Then the blocks start, and they are quick: within a few seconds of doing nothing, a large part of the screen is solid white.

## The keys

| Key | What it does |
|---|---|
| `,` (comma) | One step left. At the left end of a row you come out at the right end of the row above |
| `.` (full stop) | One step right. At the right end of a row you come out at the left end of the row below. It doesn't work from the very first cell (top-left) |
| ↑ | One step up |
| ↓ | One step down |
| Any other key | Nothing, except that it wipes away a block that has landed on top of you |
| BREAK | Stops the program |

Keys don't repeat: hold one down and you move one step. Each key press also means one block fewer, because the program only drops a block when no key is waiting.

A step into a block is refused, and you stay where you are.

## How it ends

Step onto the plus sign and the program **stops**. There is no message. BASIC prints `READY` on the line under the title and waits for your next command. Type `RUN` to play again.

If you get boxed in, nothing ends the game. Press BREAK and `RUN` again.

## Tricks and bugs worth trying

- **Wrap round.** Walking off the right edge of a row takes you to the start of the next row down, which can be much quicker than going round a wall of blocks.
- **Vanish.** Press ↑ on the top row. The asterisk disappears: it is now in the keyboard's memory, where nothing can be drawn. Press ↑ again to go one row further; a third press does nothing. Press ↓ to come back. While you are away, blocks can still fill the cells you come back into.
- **Walk through the floor (don't).** Step down from the bottom-left corner, or step right from the bottom-right corner, and the asterisk is written into the computer's working memory. BASIC breaks at once; expect a frozen screen or a restart, and switch the machine off and on if needed. Save anything you care about first.
- **Get buried.** Stand still until a block lands on you. The asterisk is hidden under it. Press any key, say the space bar, and the block is wiped away as the asterisk is drawn again.

## Playing it in Outta Here (1980 mode)

Outta Here's 1980 mode runs a step-for-step simulation of the program, built from the analysis in ORIGINAL-ARCHITECTURE.md:

- a 64 × 16 white-on-black screen with the TRS-80's block graphics, and our own dot lettering for the few characters the program and BASIC show;
- press **Enter** to run it (the screen starts at a `RUN` prompt);
- comma, full stop, ↑ and ↓ as in 1980, plus ← and → for comfort; any other key clears a block on top of you; keys don't repeat;
- the star wraps, vanishes into the keyboard's memory and can crash the machine, exactly as the addresses dictate. A line under the screen tells you where the star is (row and column, or how far into the keyboard's memory) because the screen itself can't;
- the loop drops a block about sixty times a second when you aren't pressing anything. That speed is our estimate for interpreted Level II BASIC on a 1.77 MHz Z80, not a measurement;
- reaching the plus ends it at `READY`, as in 1980. The crash is our impression of what the real machine did: the picture freezes, then memory spills onto the screen.

Getting out unlocks the **\*SCAPE** badge; crashing the computer unlocks **Crash Test**.
