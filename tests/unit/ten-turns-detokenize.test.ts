import { describe, expect, it } from "vitest";
import { detokenize, listing } from "../../scripts/detokenize-gwbasic";

/*
 * A small program tokenized by hand, the way GW-BASIC stores it, so the
 * detokenizer is tested without any original listing in the repo.
 */

const BASE = 0x1000;
const ascii = (text: string) => [...text].map((ch) => ch.charCodeAt(0));
const word = (n: number) => [n & 0xff, (n >> 8) & 0xff];

/** Lays out lines with real next-line pointers; `body(addressOf)` can point at other lines. */
function program(lines: { number: number; body: (addressOf: (line: number) => number) => number[] }[]): Uint8Array {
  // First pass to learn each line's length, second pass with the addresses filled in.
  const lengths = lines.map((l) => 4 + l.body(() => 0).length + 1);
  const addresses = new Map<number, number>();
  let at = BASE + 1;
  lines.forEach((l, i) => {
    addresses.set(l.number, at);
    at += lengths[i];
  });
  const addressOf = (n: number) => addresses.get(n)!;
  const bytes: number[] = [0xff];
  lines.forEach((l, i) => {
    const next = i + 1 < lines.length ? addressOf(lines[i + 1].number) : BASE + 1 + lengths.reduce((a, b) => a + b, 0);
    bytes.push(...word(next), ...word(l.number), ...l.body(addressOf), 0);
  });
  bytes.push(0, 0);
  return new Uint8Array(bytes);
}

const PRINT = 0x91;
const GOTO = 0x89;
const IF = 0x8b;
const THEN = 0xcd;
const END = 0x81;
const ELSE = 0xa1;
const REM = 0x8f;
const EQ = 0xe7;
const PLUS = 0xe9;
const MINUS = 0xea;
const GT = 0xe6;

const sample = program([
  { number: 10, body: () => [PRINT, ...ascii(' "HI"'), 0x3a, GOTO, 0x20, 0x0e, ...word(10)] },
  // X=X+1.5:IF X>3 THEN END ELSE 20  (1.5 as a four-byte float; ELSE is stored after a colon)
  { number: 20, body: () => [...ascii("X"), EQ, ...ascii("X"), PLUS, 0x1d, 0x00, 0x00, 0x40, 0x81, 0x3a, IF, ...ascii(" X"), GT, 0x14, 0x20, THEN, 0x20, END, 0x20, 0x3a, ELSE, 0x20, 0x0e, ...word(20)] },
  { number: 30, body: () => [REM, ...ascii(" a note: PRINT stays text")] },
  // Y=-2:Z=32767:W=&H1F:A=INT(B)
  { number: 40, body: () => [...ascii("Y"), EQ, MINUS, 0x13, 0x3a, ...ascii("Z"), EQ, 0x1c, ...word(32767), 0x3a, ...ascii("W"), EQ, 0x0c, ...word(0x1f), 0x3a, ...ascii("A"), EQ, 0xff, 0x85, ...ascii("(B)")] },
  // After RUN, GOTO targets can be stored as pointers to the line in memory.
  { number: 50, body: (addressOf) => [GOTO, 0x20, 0x0d, ...word(addressOf(10))] },
  // Q=200 (a one-byte constant) and keyword-like words inside quotes, which stay text.
  { number: 60, body: () => [...ascii("Q"), EQ, 0x0f, 200, 0x3a, PRINT, ...ascii(' "IF THEN"')] },
]);

describe("detokenize-gwbasic", () => {
  it("lists every line with its number", () => {
    expect(detokenize(sample).map((l) => l.number)).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it("turns tokens, numbers and line references back into text", () => {
    const text = listing(detokenize(sample));
    expect(text).toBe(
      [
        '10 PRINT "HI":GOTO 10',
        "20 X=X+1.5:IF X>3 THEN END ELSE 20",
        "30 REM a note: PRINT stays text",
        "40 Y=-2:Z=32767:W=&H1F:A=INT(B)",
        "50 GOTO 10",
        '60 Q=200:PRINT "IF THEN"',
        "",
      ].join("\n"),
    );
  });

  it("refuses files that aren't tokenized programs", () => {
    expect(() => detokenize(new Uint8Array(ascii("10 PRINT")))).toThrow(/first byte/);
    expect(() => detokenize(new Uint8Array([0xfe, 0, 0]))).toThrow(/protected/);
  });
});
