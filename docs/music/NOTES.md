# Bop Box: notes

The lab book: facts about MUSIC.BAS checked against its source, the quirks we found, the numbers we measured, and the checks that hold Bop Box to them. The longer explanations live in [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

How each fact was checked:

- **Read**: read in the version 1.10 listing, which lives outside the repo and is never copied into it. Numbers in brackets are its BASIC line numbers.
- **Counted**: counted by a throwaway script that parses the listing's `DATA` lines and prints only totals. It is not in the repo, because it reads IBM's data.
- **Calculated**: worked out from the listing's formula and the timer's divisor rule.
- **Inspected**: taken from the inspection of the ROM BASIC image and `BASICA.COM` 1.10 described in [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md); not repeated for this page.

## Verified facts about the original

1. The listing is version 1.10, copyright 1981 and 1982 (940–960). The tune data keeps its own header from version 1.00, 1981 (3000–3020). *Read.*
2. There are two entry points. Run from the top, the program sets its SAMPLES flag to "NO" (980) and jumps over line 1000 (990); IBM's SAMPLES menu chains in at line 1000, which sets it to "YES". *Read.*
3. On exit (1850–1860) the flag sends the program back to SAMPLES at that program's line 1000, or resets the colours, clears the screen and ends. Nothing restores 80 columns or the function-key line. *Read.*
4. The title screen first throws away any waiting keys (1100), then accepts only Space to go on or Esc to leave; every other key is ignored (1110–1140). *Read.*
5. `PLAY "mf"` is wrapped in an error trap and the trap is switched off straight after (1141–1149), so the program runs under Disk BASIC, where `PLAY` does not exist. *Read*; the error number comes from the IBM BASIC 1.10 manual.
6. `DEFINT A-Z` (1150) runs before `DIM M(88),O(70)` (1360), so the pitch table and the column map are integer arrays. *Read.*
7. The pitch table holds 36.8 × 2^((k − 6)/12) for keys 7 to 88 (1370) and 32767 for keys 0 to 6 (1380). *Read.*
8. With the timer's truncating divisor, A4 sounds at 441.10 Hz, 4.3 cents sharp. Over the keys the tunes use (30–66) the error runs from +0.21 cents (G3) to +7.86 cents (A3), with a mean of +4.58 cents; the A3–A4 octave is 1196.5 cents wide. *Calculated*; the truncation itself is *inspected*.
9. A rest is played as 32767 Hz, which gives a divisor of 36 and a tone of about 33.1 kHz. *Calculated.*
10. The keyboard is drawn from B3 to C6: 16 white keys over columns 5–36 (1210–1230) and 10 black keys, the loop skipping gaps 2, 6 and 9 and testing a gap 13 it never reaches (1240–1270). *Read.*
11. The column map covers keys 39 to 70 (1390–1470), but markers are only drawn for keys 39 to 64 (1560, 1600). Key 69's column breaks the octave pattern and key 70's column (42) is off the 40-column screen. *Read.*
12. Whether a key is white or black is decided by reading the character on screen at row 5 of its column (1570, 1610). *Read.*
13. The keyboard is polled once per note (1500). Esc ends the tune (1510); any other key only clears BASIC's half-typed function-key text (1520). *Read.*
14. A silent tick follows every event except a rest of exactly one tick (1590–1595). *Read.*
15. There are 22 one-tick rests, all in La Cucaracha. *Counted.*
16. The menu accepts each letter in upper or lower case, moves the `DATA` pointer to the tune with `RESTORE` (1680–1761) and asks again for any other key (1769). *Read.*
17. The −2 marker before each title is read and thrown away (1780). The title is centred on row 23 from its length (1800–1805) and erased afterwards with 39 spaces (1820). *Read.*
18. The tunes are stored in the order BUG, BLUE, HUMOR, POP, FORTY, DANDY, MARCH, STARS, HAT, SCALES, SAKURA (3200–4550), not in menu order. *Read.*
19. The eleven tunes hold 868 key-and-duration pairs: 683 notes and 185 rests, on keys 30 to 66, with durations from 1 to 24 ticks. *Counted.*
20. The one-tick gap stretches each tune by a factor from 1.12 (SAKURA) to 1.70 (SCALES). The per-tune figures are in the table in [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md). *Counted.*
21. The longest event is a 24-tick note in HUMOR, so Esc can wait 25 ticks, about 1.37 s, before it is noticed. *Counted.*
22. Six tunes play notes outside the drawn keyboard: MARCH (D3, A3), BUG (D3, G3, A3), FORTY (C♯6), HAT (D6), BLUE (D6) and SCALES (A♯3, C♯6). *Counted.*
23. Line 1840's `END` can never run: line 1830 always jumps back to the prompt and nothing jumps to 1840. *Read.*

## Quirks and bugs

| Quirk | Why | In Bop Box |
|---|---|---|
| Every note is slightly sharp; A4 is 441.10 Hz | A rounded anchor (36.8 Hz) and rounding to whole hertz (1370), then a truncated timer divisor | Kept in PC Speaker ’81 only |
| Every note is detached, and tunes stretch by 12–70 % | A silent tick after each event (1595) | Kept in PC Speaker ’81 only |
| A one-tick rest gets no gap ("staccato") | The test on line 1590 | Not modelled. No 1981 excerpt in Bop Box has a one-tick rest, so nothing changes |
| Notes off the drawn keyboard sound with no marker | Markers only for keys 39–64 (1560, 1600) | PC Speaker ’81 shows an "off the edge" sign instead. Our transcriptions reach off the edge in three tunes, not six |
| SCALES begins and ends one semitone beyond each edge of the keyboard | Its data runs from A♯3 to C♯6 | Not kept: our Scales runs from B3 to C6 |
| The marker shows during the gap before its note | Drawn before the `SOUND` (1570–1580) | Not kept: a key lights while its note sounds |
| Esc waits for the current note, up to about 1.4 s | One poll per note (1500) | Not kept: Space pauses at once |
| Dead code: a gap-13 test the loop never reaches, map entries for keys 65–70, an `END` that never runs | Lines 1250, 1470, 1840 | Invisible; nothing to keep |
| The SCALES title is padded to 32 characters, so its red bar is wide | Its title string | Not kept |
| Run on its own, it leaves 40 columns and no function-key line | Line 1860 resets only the colours | Not applicable in a browser |
| "STACCATTO", "Weasle", "J.S.Strauss", "Dvorak" | A comment (1590) and three titles | Correct spellings on screen; the history is told in [ABOUT.md](ABOUT.md) |

## Simulations

### PC Speaker ’81 against the 1981 program

The 1981 figures are *counted* from the listing (time as played: written ticks plus the gaps, at 18.2 ticks a second). The Bop Box figures are for the PC Speaker ’81 arrangement of each 1981 excerpt; `npm run check:music` prints them on its `pc81:` lines as tracks, notes, seconds and a tempo (ticks per beat = 1092 ÷ that tempo).

| Tune | 1981: notes | 1981: range | 1981: time | Bop Box: notes | Bop Box: range | Bop Box: ticks per beat | Bop Box: time | Difference |
|---|---|---|---|---|---|---|---|---|
| Funeral March (A) | 72 | D3–E5 | 20.7 s | 76 | D3–E5 | 6 | 22.4 s | +8 % |
| Stars and Stripes (B) | 73 | D4–G5 | 25.5 s | 72 | D4–G5 | 6 | 26.8 s | +5 % |
| Symphony No. 40 (C) | 80 | F♯4–C♯6 | 21.1 s | 71 | F♯4–C6 | 4 | 18.6 s | −12 % |
| Mexican Hat Dance (D) | 65 | A4–D6 | 14.3 s | 65 | A4–D6 | 4 | 14.8 s | +3 % |
| Humoresque (E) | 48 | G4–A5 | 14.1 s | 50 | G4–A5 | 4 | 9.9 s | −30 % |
| La Cucaracha (F) | 40 | D3–E5 | 9.7 s | 36 | D4–E5 | 4 | 9.6 s | −1 % |
| Pop! Goes the Weasel (G) | 56 | D4–A5 | 14.7 s | 56 | D4–A5 | 4 | 13.6 s | −7 % |
| Yankee Doodle (H) | 55 | D4–D♯5 | 13.8 s | 55 | B3–C5 | 6 | 13.7 s | −1 % |
| Sakura (I) | 36 | B3–C5 | 19.8 s | 50 | B3–C5 | 8 | 27.4 s | +38 % |
| The Blue Danube (J) | 102 | C♯4–D6 | 40.5 s | 71 | C♯4–D6 | 4 | 25.9 s | −36 % |
| Scales (K) | 56 | A♯3–C♯6 | 7.6 s | 57 | B3–C6 | 2 | 6.9 s | −9 % |

Seven tunes are within 10 %. The four outliers come from the transcription, not the model: Humoresque's swung beat takes six ticks in 1981 and four in ours, and our Blue Danube, Sakura and Mozart excerpts hold a different number of notes. Pitch matches exactly: the model's `pc81Frequency(69)` gives 441.102 Hz for A4 and 262.007 Hz for C4, the values in the table in [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md).

### `npm run check:music`, 7 October 2026

**`check-songs.ts`** parsed all 22 versions. The full versions at their scores' own tempos:

| Tune | Bars | Sections | Keys | Length |
|---|---|---|---|---|
| Funeral March | 212 | 13 | 2 | 316 s |
| Stars and Stripes | 212 | 10 | 2 | 219 s |
| Symphony No. 40 | 299 | 3 | 1 | 332 s |
| Mexican Hat Dance | 57 | 8 | 2 | 59 s |
| Humoresque | 64 | 7 | 2 | 109 s |
| La Cucaracha | 42 | 6 | 1 | 78 s |
| Pop! Goes the Weasel | 53 | 7 | 1 | 66 s |
| Yankee Doodle | 52 | 7 | 1 | 55 s |
| Sakura | 31 | 3 | 1 | 107 s |
| The Blue Danube | 692 | 38 | 5 | 821 s |
| Scales | 40 | 13 | 12 | 86 s |

**`check-arrangements.mts`** built every style on all 22 versions (264 arrangements) and ended "all arrangements OK". For the three composers' scores:

| Score | Parts | Tune notes heard in the parts | 1981 excerpt notes heard | Excerpt found at | Notes matched |
|---|---|---|---|---|---|
| Mozart (forty) | 11 | 99.3 % | 98.6 % | full beat 3, same key | 12 of 12 |
| Gounod (march) | 16 | 99.6 % | 93.4 % | full beat 65.5, same key | 8 of 12 |
| Sousa (stars) | 26 | 98.5 % | 95.8 % | full beat 270; the 1981 excerpt is a semitone below Sousa's key and one of its beats is two of his | 12 of 12 |

**`check-1981.mts` failed at first**, with exit code 1, reporting all 297 stored 1981 arrangements as changed. The cause was the retrofit, not the music. Each fingerprint hashed the arrangement's JSON, patches included, and the retrofit replaced every patch's emoji `icon` with an `InstrumentFamily` for the SVG icons. Recomputing the fingerprints with each patch's old icon put back in place of its family (a throwaway script outside the repo, reading the patch table as committed) matched all 297 stored fingerprints, so the 1981 arrangements are note-for-note unchanged.

The check now leaves the patch's picture (`family`) out of the hash, and the fingerprints were stored again. Since every style is fingerprinted, Hip-hop and the Original Score joined the list: 319 fingerprints, and the check ends:

```text
all 319 1981 arrangements unchanged
```

### `npm run check:audio`, 7 October 2026

`render-check.mts 8` rendered the first 8 seconds of 242 arrangements (11 tunes, 11 styles, both lengths; PC Speaker ’81 is not rendered) with the real sound bank, and ended "all renders OK" with no missing presets. It took about 50 seconds.

| | Lowest | Highest |
|---|---|---|
| Peak | 0.08 (Funeral March, 1981, Original Score) | 0.70 (Stars and Stripes, full, Original Score) |
| RMS | −39.2 dB (Funeral March, 1981, Original Score) | −18.3 dB (Stars and Stripes, full, Original Score) |

Every render sits between the silence threshold (peak 0.02) and the clipping threshold (peak 0.99).

## The Live view

### Facts the performers rely on

1. **The 1981 screen** that PC Speaker ’81's computer shows is drawn from the layout read in the listing (see [ORIGINAL-ARCHITECTURE.md](ORIGINAL-ARCHITECTURE.md)): the red frame on rows 4 and 13 from column 4 to 37, sixteen white keys two columns wide from column 5, black keys a cell and a half wide on the seams, the marker on row 11 (black on grey) for a white key and on row 7 (white on black) for a black key, the title white on red on row 23. The marker stays on its key through the one-tick gap after each note, as the program's did. *Read.* The title shown is our own tune title, not the 1981 one.
2. **The 1981 PC's keyboard had no indicator lights**: the 83-key keyboard of the first PC showed no Caps Lock or Num Lock lamps (they came with the 1984 PC AT keyboard). So the brief's "keyboard lights" became the screen's marker and a cut-away of the speaker cone instead. *Hardware reference.*
3. **Trumpet valves** follow the standard chart for a B-flat trumpet (open, 2, 1, 1-2, 2-3, 1-3, 1-2-3 down each harmonic); the trombone's seven slide positions count down a semitone at a time from the nearest harmonic of B-flat (34, 46, 53, 58, 62, 65, 68, 70…). Low E2 is in seventh position, F3 in first, E3 in second. *Calculated*, checked in the unit test.
4. **Orchestra seating**: first violins on the audience's left, violas and cellos towards the right, basses behind the cellos, winds in the middle behind the strings, horns, brass and timpani at the back, harp on the left. The timpani's largest kettle is on the player's left. *Common practice.*
5. **The harp's strings**: every C red and every F dark, as concert harps are marked; bass strings by the column, treble by the player's shoulder. *Common practice.*
6. **The kendang's "dhut"**: struck on the big head with the palm, the heel of the hand pressing into the skin to bend the pitch down; the arrangement bends every dhut the same way (`sagDrum` in `styles.ts`), so the hand stays on the head for as long as the bend lasts. The ketipung's open "tung" bounces off; the damped "tak" stays on the skin. *Common practice.*
7. **A koto** has thirteen strings over movable bridges, plucked near the right end by the right hand; **a kalimba**'s lowest tine is in the middle, each step up alternating sides; **a steel pan**'s notes go round in a circle of fifths, octaves inside. *Common practice.*

### Frame rates

Measured on the lab page at the size the view has in the studio at 1920×1080 (912×452), 3 s per scene, with the clock running.

| Scene | RTX 4060 (GPU) | Without a GPU (SwiftShader), full detail | Without a GPU, as shipped (`data-detail="light"`) |
|---|---|---|---|
| Original Score, Sousa (14 tracks, about 25 players) | 60 | 26–29 | 59–60 |
| Original Score, Mozart | 60 | 21–24 | 57–59 |
| Pop | 60 | 58 | 58+ |
| Dangdut | 60 | 46–56 | 60 |
| Solo piano, Lo-fi, House | 60 | 60 | 60 |

The shading and rim passes (a clip per painted part) are what a software renderer pays for; dropping them on software only brings every scene to about 60 frames a second. On a GPU nothing is lowered.

### How the scenes were judged

Every scene was drawn in the lab at the studio's size in both themes and critiqued round by round before it reached the studio. Stage one (the hero frames, approved by the owner on 10 October 2026) settled the look: the solo piano seen from above with the lid off (the only angle where both hands and the right keys show), seated players turned in towards a conductor, the violin's bow below the chin, a freeze with the head near the floor rather than floating, a DJ framed by the LED wall, a robot close enough to read, the rooftop's awning above the sitter's head. Stage two filled every band and found the rest: back rows hidden behind front rows (higher risers, staggered and wider back lines), a front row too wide in the big orchestras (sections give up players), flutists' and trumpeters' arms across their faces (they turn towards their instrument), a ukulele-sized guitar, a saxophone hidden by the forearms (instruments are now drawn over the arms and under the hands), three identical "Mute" buttons for one section (one per part now), and an E2 that had crept into the trombone's harmonic series.

## Regression checks

| Check | What it locks | Tolerance | Fails the run? |
|---|---|---|---|
| `scripts/check-songs.ts` | Every bar, section, pickup, chord chart and form of all 22 versions | Exact (pickups within 1e-6 beats) | Yes: the parser throws |
| `scripts/check-arrangements.mts` | Valid notes in every style and version; bars tile each arrangement; the tempo map starts at 0 | Round trip `toSongBeat(fromSongBeat(x))` within 1e-6 beats; bar grid within 1e-6 | Yes: prints `PROBLEM` lines and exits 1 |
| `scripts/check-arrangements.mts` | The composers' scores: printed bars fill every section of the form; the lead sheet's notes sound in the parts; the 1981 excerpt is found in the piece | Share of notes at least 90 % (now 98.5–99.6 %); a note counts within 0.02 beats; excerpt at least 8 of 12 notes (Gounod is at 8, on the line) | Yes, as above |
| `scripts/check-1981.mts` | The 1981 arrangements of every style plus Solo on each of its 18 instruments, for all eleven tunes: 319 fingerprints in `scripts/bopbox-1981.fingerprints.json`. How an instrument is pictured is left out | Exact SHA-256 (first 16 hex digits), beat maps rounded to 1e-9 | Yes: exit 1 |
| `scripts/render-check.mts` | Every SoundFont style makes sound and doesn't clip, with every preset present | Peak between 0.02 and 0.99 over the first 8 s | Yes: exit 1 |
| `tests/unit/migration.test.ts` | A version-1 save under `anykey.bopbox.v1` becomes `{ version: "full" }` with empty lists | Exact | Yes |
| `tests/unit/manifest.test.ts` | Six to eight achievements, unique ids, known tiers, an emblem path | Exact | Yes |
| `tests/e2e/keyring.spec.ts` | Pressing 9 and Play unlocks First Note and Beep Beep, with toasts | | Yes |
| `tests/e2e/navigation.spec.ts` | K picks a tune and stays on `/music`; `?` opens and Esc closes the shortcuts | | Yes |
| `tests/e2e/first-visit.spec.ts` | The first-visit hint says Esc goes back to the Hall | | Yes |
| `tests/e2e/story.spec.ts` | At least six Story chapters, every Mermaid diagram drawn | 15 s per chapter | Yes |
| `tests/unit/bopbox-perform.test.ts` | The Live view's motion: a stick touches down on each note, the kit's limbs, a fast roll shared between hands, bowing directions and the bow kept on its length, a hand's steps and fingers, trumpet valves, trombone positions, tone holes, casting, the drop, the breaker's drop and freeze, the DJ's cue and raise | Exact, strikes within 1e-5 | Yes |
| `tests/e2e/bopbox-live.spec.ts` | The Live view draws; one button per part mutes it, and the Band list agrees; V reaches it; the show follows the style; Esc goes back to the Hall | | Yes |

Not locked by anything: the 1981 Hip-hop and Original Score arrangements, every full-version arrangement, and the PC Speaker ’81 timing figures above.

## Open questions

1. **Who wrote MUSIC?** No author line survives in versions 1.00 or 1.10 (see [ABOUT.md](ABOUT.md)). An IBM or Microsoft document naming the programmer would settle it.
2. **Why does the column map run to key 70?** Entries 65–70 can never be used, and two are wrong or off the screen. An earlier layout is a guess. A listing from before version 1.00 would settle it.
3. **Does the work between notes fit inside the 55 ms gap on a real 4.77 MHz PC?** Reasoned from the code, not measured. A recording on real hardware, or in a cycle-accurate emulator, would settle it.
4. **What does `POKE 106,0` do under GW-BASIC?** Unverified; reading the GW-BASIC data-segment layout would settle it.
5. **Version 1.00's leftover tune tails.** That a longer tune's tail stayed in memory after `CHAIN MERGE` is inferred from the manual, not observed. Running 1.00 in PCjs would settle it.
6. **Should PC Speaker ’81 follow the 1981 timing more closely?** Humoresque at six ticks a beat, and Blue Danube, Sakura and Mozart excerpts closer to the 1981 note counts, would bring the four outliers nearer. It means re-transcribing four excerpts in our own notation, and new fingerprints. A decision for the owner.
