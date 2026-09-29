# Using the original MUSIC program

This guide explains how IBM's 1981–82 *MUSIC* sample program behaves from the user's side: what each screen shows, which keys do what, and how the program exits. It then covers four ways to run the original today. All behaviour described here was checked against the version 1.10 listing. Line numbers such as "line 1510" refer to that listing and are explained in [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md).

## Starting the program

There are three ways to start it on an IBM PC with PC DOS 1.10 (or the PC DOS 2.00 supplemental diskette):

- From the DOS prompt, type `BASICA MUSIC`. `BASIC MUSIC` (Disk BASIC) also works, as the program is written to run without Advanced BASIC.
- From inside BASIC, type `RUN "MUSIC"`.
- Through IBM's sample menu: start `BASICA SAMPLES`, press the space bar, then press **A**.

The last route matters, because the program remembers how it was started. It uses that to decide where Esc takes you at the end (see [Leaving the program](#leaving-the-program)).

## Screen 1: the title screen

The program switches to 40-column colour text on a black background. It shows "IBM" and "Personal Computer" in bright white, a light-green box with the program name and "Version 1.10", a copyright line, and a yellow prompt at the bottom asking for the space bar.

| Key | Effect |
|---|---|
| Space | Continue to the main screen |
| Esc | Leave the program at once, without seeing the main screen |
| Anything else | Ignored |

Keys you pressed before the title appeared are thrown away first, so type-ahead cannot skip this screen.

## Screen 2: the keyboard and the menu

The screen turns blue. The top half shows a small piano keyboard in a red frame, with 16 white keys and 10 black keys running from B3 to C6. Below it is the list of selections, and below that is a light-grey prompt bar that asks for your choice.

| Key | Label | Tune |
|---|---|---|
| A | MARCH | Funeral March of a Marionette (Gounod) |
| B | STARS | The Stars and Stripes Forever (Sousa) |
| C | FORTY | Symphony No. 40, opening (Mozart) |
| D | HAT | Mexican Hat Dance (traditional) |
| E | HUMOR | Humoresque (Dvořák) |
| F | BUG | La Cucaracha (folk song) |
| G | POP | Pop! Goes the Weasel |
| H | DANDY | Yankee Doodle |
| I | SAKURA | Sakura (Japanese folk melody) |
| J | BLUE | The Blue Danube (Johann Strauss II) |
| K | SCALES | A chromatic scale up and down |
| Esc | – | Leave the program |

- **Case does not matter.** Both `A` and `a` work. Your choice is echoed on the prompt bar exactly as you typed it, for example `b-STARS`.
- **Other keys are ignored.** Pressing anything else simply shows the prompt again. There is no error message or beep.
- **Keys typed during a tune are discarded** before the menu reads its next key, so you cannot queue up the next selection in advance.

## While a tune plays

- The **full title** of the tune appears centred near the bottom of the screen, in white on a red bar.
- A **♫ marker** moves across the keyboard, sitting on the key that is sounding. On white keys it appears near the bottom of the key, in black. On black keys it appears in the middle, in white.
- **Notes outside B3–C6 have no marker.** They still play, but no key lights up. The tunes affected are:

  | Tune | Notes with no marker |
  |---|---|
  | MARCH | D3 and A3, including the tune's first two notes |
  | BUG | D3, G3 and A3 |
  | FORTY | C♯6 |
  | HAT | D6 |
  | BLUE | D6 |
  | SCALES | A♯3 and C♯6, the first and last notes of the scale |

  STARS, HUMOR, POP, DANDY and SAKURA stay entirely on the drawn keyboard.
- **Rests** show no marker.
- **Every note is detached.** A silence of about 1/18 of a second follows every note, apart from the very short rests in *La Cucaracha*. Tunes therefore sound slightly clipped and play more slowly than their written durations suggest.
- **Esc stops the tune.** The program checks the keyboard once per note, so Esc takes effect when the current note ends. That can take up to about 1.4 seconds during the longest note, in HUMOR. The marker is removed, the title bar disappears, and you return to the menu prompt.
- **Other keys are ignored** during a tune. If you press a function key, the program also cancels the text that BASIC would normally type for it (line 1520).
- **Ctrl+Break** stops BASIC itself, not just the tune. You land at BASIC's `Ok` prompt with a "Break in …" message and the screen still blue and 40 columns wide.

When a tune finishes normally, the title bar is erased and the prompt bar resets, ready for the next choice.

## Leaving the program

Press **Esc** on the title screen or at the menu. What happens next depends on how the program was started:

- **Started on its own** (`BASICA MUSIC` or `RUN "MUSIC"`). The screen is reset to grey on black and cleared, and you are back at BASIC's `Ok` prompt. The program does **not** restore the 80-column screen or the function-key line at the bottom. Type `WIDTH 80` and `KEY ON` to get them back, or `SYSTEM` to return to DOS.
- **Started from SAMPLES.** MUSIC chains back to `SAMPLES` at that program's line 1000, which jumps straight to its program menu and skips its title screen. `SAMPLES.BAS` must still be on the current drive.

## Running the original today

### Option 1: PCjs (in the browser, with IBM's own disk)

[PCjs](https://www.pcjs.org/) emulates the IBM PC 5150 with IBM's ROM BASIC and hosts the original PC DOS diskettes, so you can run the genuine program without copying any files.

1. Open the IBM PC with Color Graphics machine: https://www.pcjs.org/machines/pcx86/ibm/5150/cga/
2. In the diskette controls, select drive A:, choose **PC DOS 1.10** from the list and click **Load**.
3. Restart the machine with its Reset button or Ctrl+Alt+Del, then press Enter at the date and time prompts.
4. At `A>`, type `BASICA MUSIC`. To use the original menu instead, type `BASICA SAMPLES` and choose A.

You can also use PC DOS 2.00. Its "Disk 2" (Supplemental Programs) holds a byte-identical `MUSIC.BAS`, but there it runs under BASICA 2.00 rather than 1.10.

Caveats:

- The PCjs page for PC DOS 1.10 embeds a machine with a **monochrome** display. MUSIC was designed for colour 40-column text, so use the CGA machine above. Exactly how it looks on a monochrome adapter was not tested.
- Browsers only allow audio after you interact with a page, so **click inside the emulator** before choosing a tune. PCjs plays the speaker through a Web Audio square-wave oscillator. It treats tones above 20 kHz as silence, so MUSIC's 32767 Hz "rests" are silent there. Whether sound is switched on depends on the machine's configuration. If you hear nothing, check that the tab isn't muted.

### Option 2: PC-BASIC (free, cross-platform)

[PC-BASIC](https://github.com/robhagemans/pcbasic) is an open-source reimplementation of GW-BASIC and IBM BASICA that emulates the display and speaker.

1. Install it with a desktop installer from its GitHub releases, or with `pip3 install pcbasic`.
2. Run the text listing with `pcbasic MUSIC.BAS --preset=basica`. The `basica` preset emulates IBM BASICA. Plain `pcbasic MUSIC.BAS` also works and emulates GW-BASIC on a VGA machine, which displays 40-column colour text fine.

Caveats:

- PC-BASIC accepts text files with either Unix (LF) or DOS (CR LF) line endings.
- It only emulates part of the PC's memory, and a `POKE` outside those areas does nothing. The program's `POKE 106,0` keyboard housekeeping (lines 975 and 1520) is therefore a no-op. That makes no visible difference.
- `PLAY "MF"` is accepted, so the program's error trap never fires.

### Option 3: DOSBox with GW-BASIC

- **IBM's `BASIC.COM` and `BASICA.COM` will not run in DOSBox or on clones.** They depend on the Cassette BASIC in the IBM PC's ROM, which DOSBox does not provide. Use Microsoft's stand-alone GW-BASIC instead.
- Microsoft's open-source release of GW-BASIC on GitHub contains the 1983 **source code only, with no executable**. You need a GW-BASIC binary from a DOS distribution you are licensed to use.
- GW-BASIC only accepts text programs with **CR LF** line endings. A listing with Unix line endings will not load correctly; PC-BASIC's documentation says to expect "Line buffer overflow". Convert it first, for example with `unix2dos`.
- Start it with `GWBASIC MUSIC.BAS`. Setting `machine=cga` in `dosbox.conf` gives a more authentic look, although the default video card also handles 40-column text. DOSBox emulates the PC speaker.
- `POKE 106,0` writes one byte into BASIC's own data area. Its meaning in IBM BASIC is documented in the architecture notes. Nobody has checked that GW-BASIC keeps the same variable at the same address, so its effect there is unverified.

### Option 4: real hardware

Use an IBM PC 5150, or another IBM model with Cassette BASIC in ROM, fitted with a Color/Graphics adapter and a colour or composite monitor. The file is on the PC DOS 1.10 diskette, and the PC DOS 2.00 Supplemental Programs diskette carries an identical copy. The 1.10 `SAMPLES` menu lists MUSIC as a 48 KB program. PC DOS 2.10 ships a slightly edited text copy: the spelling of "Weasel" is fixed and the Mozart ending is changed. On compatibles without IBM's ROM BASIC, use GW-BASIC as in Option 3.

## Caveats at a glance

| Topic | What to expect |
|---|---|
| Disk BASIC vs BASICA | Both work. In Disk BASIC the `PLAY "MF"` statement raises error 73 ("Advanced Feature"), and MUSIC silently traps and ignores it. |
| GW-BASIC vs BASICA | GW-BASIC supports every statement MUSIC uses and does not need IBM's ROM. Only the effect of `POKE 106,0` is unverified. |
| 40-column mode | The program assumes colour 40-column text and leaves the screen in that mode when it exits. |
| Speaker emulation | Rests are really a 32767 Hz tone. The real PC produces about 33 kHz, far above hearing. Emulators may simply mute it, as PCjs does. |
| Pitch | Notes are 0.2–7.9 cents sharp by design. A4 sounds at about 441.1 Hz, so don't retune your emulator to "fix" it. |
| Timing | Durations are counted in 18.2 Hz timer ticks, plus one tick of silence after each note. If an emulated CPU is extremely slow, the screen updates between notes may no longer fit inside that gap. |
| Esc latency | Esc is noticed at the end of the current note, not immediately. |

## Sources

- IBM Personal Computer BASIC, Version 1.10 manual (May 1982): http://www.bitsavers.org/pdf/ibm/pc/languages/BASIC_1.1_May82.pdf
- PCjs – BASIC Programs for PC DOS 1.00 (SAMPLES listing, including its line 1000): https://www.pcjs.org/software/pcx86/app/ibm/basic/1.00/
- PCjs – IBM PC DOS 1.10: https://www.pcjs.org/software/pcx86/sys/dos/ibm/1.10/
- PCjs – IBM PC DOS 2.00: https://www.pcjs.org/software/pcx86/sys/dos/ibm/2.00/
- PCjs – IBM PC (Model 5150) with Color Graphics: https://www.pcjs.org/machines/pcx86/ibm/5150/cga/
- PCjs disk images (SAMPLES 1.10 and the MUSIC copies): https://diskettes.pcjs.org/pcx86/sys/dos/ibm/1.10/PCDOS110.json, https://diskettes.pcjs.org/pcx86/sys/dos/ibm/2.00/PCDOS200-DISK2.json, https://diskettes.pcjs.org/pcx86/sys/dos/ibm/2.10/PCDOS210-DISK2.json
- PCjs source, speaker emulation (`chipset.js`): https://github.com/jeffpar/pcjs/blob/master/machines/pcx86/modules/v2/chipset.js
- PC-BASIC repository and README: https://github.com/robhagemans/pcbasic
- PC-BASIC documentation (presets, line endings, POKE, memory model): https://robhagemans.github.io/pcbasic/doc/2.0/
- PC-BASIC memory emulation source: https://github.com/robhagemans/pcbasic/blob/master/pcbasic/basic/memory/memory.py
- Microsoft GW-BASIC source release: https://github.com/microsoft/GW-BASIC
- Wikipedia – IBM BASIC: https://en.wikipedia.org/wiki/IBM_BASIC
- DOSBox wiki – Sound: https://www.dosbox.com/wiki/Sound
- DOSBox wiki – dosbox.conf (machine option): https://www.dosbox.com/wiki/Dosbox.conf
