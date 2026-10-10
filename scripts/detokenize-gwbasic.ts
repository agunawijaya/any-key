/*
 * Turns a tokenized GW-BASIC (or IBM BASICA) program back into a listing.
 *
 *   npx tsx scripts/detokenize-gwbasic.ts <program.bas> [listing.txt]
 *
 * Originals are read-only and stay outside the repo: write the listing next
 * to them or to a scratch folder, never into the repo.
 *
 * File layout: a 0xFF byte, then lines. Each line is a two-byte pointer to the
 * next line (0 ends the program), a two-byte line number, the tokenized text
 * and a 0x00. Keywords are one byte from 0x81, or two bytes after a 0xFD, 0xFE
 * or 0xFF prefix; numbers are stored in binary after their own markers.
 * Protected (0xFE) files are encrypted and not handled here.
 */

import { readFileSync, writeFileSync } from "node:fs";

const KEYWORDS: Record<number, string> = {
  0x81: "END", 0x82: "FOR", 0x83: "NEXT", 0x84: "DATA", 0x85: "INPUT", 0x86: "DIM", 0x87: "READ", 0x88: "LET",
  0x89: "GOTO", 0x8a: "RUN", 0x8b: "IF", 0x8c: "RESTORE", 0x8d: "GOSUB", 0x8e: "RETURN", 0x8f: "REM", 0x90: "STOP",
  0x91: "PRINT", 0x92: "CLEAR", 0x93: "LIST", 0x94: "NEW", 0x95: "ON", 0x96: "WAIT", 0x97: "DEF", 0x98: "POKE",
  0x99: "CONT", 0x9c: "OUT", 0x9d: "LPRINT", 0x9e: "LLIST", 0xa0: "WIDTH", 0xa1: "ELSE", 0xa2: "TRON", 0xa3: "TROFF",
  0xa4: "SWAP", 0xa5: "ERASE", 0xa6: "EDIT", 0xa7: "ERROR", 0xa8: "RESUME", 0xa9: "DELETE", 0xaa: "AUTO", 0xab: "RENUM",
  0xac: "DEFSTR", 0xad: "DEFINT", 0xae: "DEFSNG", 0xaf: "DEFDBL", 0xb0: "LINE", 0xb1: "WHILE", 0xb2: "WEND", 0xb3: "CALL",
  0xb7: "WRITE", 0xb8: "OPTION", 0xb9: "RANDOMIZE", 0xba: "OPEN", 0xbb: "CLOSE", 0xbc: "LOAD", 0xbd: "MERGE", 0xbe: "SAVE",
  0xbf: "COLOR", 0xc0: "CLS", 0xc1: "MOTOR", 0xc2: "BSAVE", 0xc3: "BLOAD", 0xc4: "SOUND", 0xc5: "BEEP", 0xc6: "PSET",
  0xc7: "PRESET", 0xc8: "SCREEN", 0xc9: "KEY", 0xca: "LOCATE", 0xcc: "TO", 0xcd: "THEN", 0xce: "TAB(", 0xcf: "STEP",
  0xd0: "USR", 0xd1: "FN", 0xd2: "SPC(", 0xd3: "NOT", 0xd4: "ERL", 0xd5: "ERR", 0xd6: "STRING$", 0xd7: "USING",
  0xd8: "INSTR", 0xd9: "'", 0xda: "VARPTR", 0xdb: "CSRLIN", 0xdc: "POINT", 0xdd: "OFF", 0xde: "INKEY$",
  0xe6: ">", 0xe7: "=", 0xe8: "<", 0xe9: "+", 0xea: "-", 0xeb: "*", 0xec: "/", 0xed: "^", 0xee: "AND", 0xef: "OR",
  0xf0: "XOR", 0xf1: "EQV", 0xf2: "IMP", 0xf3: "MOD", 0xf4: "\\",
};

const FUNCTIONS: Record<number, string> = {
  0x81: "LEFT$", 0x82: "RIGHT$", 0x83: "MID$", 0x84: "SGN", 0x85: "INT", 0x86: "ABS", 0x87: "SQR", 0x88: "RND",
  0x89: "SIN", 0x8a: "LOG", 0x8b: "EXP", 0x8c: "COS", 0x8d: "TAN", 0x8e: "ATN", 0x8f: "FRE", 0x90: "INP", 0x91: "POS",
  0x92: "LEN", 0x93: "STR$", 0x94: "VAL", 0x95: "ASC", 0x96: "CHR$", 0x97: "PEEK", 0x98: "SPACE$", 0x99: "OCT$",
  0x9a: "HEX$", 0x9b: "LPOS", 0x9c: "CINT", 0x9d: "CSNG", 0x9e: "CDBL", 0x9f: "FIX", 0xa0: "PEN", 0xa1: "STICK",
  0xa2: "STRIG", 0xa3: "EOF", 0xa4: "LOC", 0xa5: "LOF",
};

const CONVERSIONS: Record<number, string> = { 0x81: "CVI", 0x82: "CVS", 0x83: "CVD", 0x84: "MKI$", 0x85: "MKS$", 0x86: "MKD$", 0x8b: "EXTERR" };

const STATEMENTS: Record<number, string> = {
  0x81: "FILES", 0x82: "FIELD", 0x83: "SYSTEM", 0x84: "NAME", 0x85: "LSET", 0x86: "RSET", 0x87: "KILL", 0x88: "PUT",
  0x89: "GET", 0x8a: "RESET", 0x8b: "COMMON", 0x8c: "CHAIN", 0x8d: "DATE$", 0x8e: "TIME$", 0x8f: "PAINT", 0x90: "COM",
  0x91: "CIRCLE", 0x92: "DRAW", 0x93: "PLAY", 0x94: "TIMER", 0x95: "ERDEV", 0x96: "IOCTL", 0x97: "CHDIR", 0x98: "MKDIR",
  0x99: "RMDIR", 0x9a: "SHELL", 0x9b: "ENVIRON", 0x9c: "VIEW", 0x9d: "WINDOW", 0x9e: "PMAP", 0x9f: "PALETTE",
  0xa0: "LCOPY", 0xa1: "CALLS", 0xa4: "NOISE", 0xa5: "PCOPY", 0xa6: "TERM", 0xa7: "LOCK", 0xa8: "UNLOCK",
};

const REM = 0x8f;
const APOSTROPHE = 0xd9;
const ELSE = 0xa1;
const DATA = 0x84;

/** Microsoft Binary Format: an exponent byte (bias 128, 0 means zero) after a sign-and-mantissa field. */
function mbf(bytes: Uint8Array): number {
  const exponent = bytes[bytes.length - 1];
  if (exponent === 0) return 0;
  const high = bytes[bytes.length - 2];
  const negative = (high & 0x80) !== 0;
  let mantissa = (high | 0x80) / 256;
  for (let i = bytes.length - 3, scale = 256 * 256; i >= 0; i--, scale *= 256) mantissa += bytes[i] / scale;
  const value = mantissa * 2 ** (exponent - 128);
  return negative ? -value : value;
}

/** A number the way LIST shows it: no leading zero before the point, a type mark only when needed. */
function formatNumber(value: number, digits: number, mark: string): string {
  let text = Number(value.toPrecision(digits)).toString();
  if (text.includes("e")) {
    const [m, e] = text.split("e");
    const exp = Number(e);
    text = `${m}${mark === "#" ? "D" : "E"}${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
    return text;
  }
  text = text.replace(/^(-?)0\./, "$1.");
  const isWhole = Number.isInteger(value);
  // A whole number that fits an integer would read back as an integer; the mark keeps its type.
  if (mark === "#" || (isWhole && Math.abs(value) <= 32767)) return `${text}${mark}`;
  return text;
}

export type ListingLine = { number: number; text: string };

export function detokenize(bytes: Uint8Array): ListingLine[] {
  if (bytes[0] === 0xfe) throw new Error("This program was saved protected (,P); it is encrypted and can't be listed here.");
  if (bytes[0] !== 0xff) throw new Error("Not a tokenized GW-BASIC program: the first byte should be 0xFF.");

  const word = (at: number) => bytes[at] | (bytes[at + 1] << 8);
  // Line pointers are memory addresses. The first line's "next" pointer tells us where the file sits in memory.
  const lineStarts: number[] = [];
  for (let at = 1; at + 1 < bytes.length && word(at) !== 0; ) {
    lineStarts.push(at);
    let end = at + 4;
    while (end < bytes.length && !(bytes[end] === 0 && isLineEnd(bytes, at, end))) end++;
    at = end + 1;
  }
  const base = lineStarts.length > 1 ? word(lineStarts[0]) - lineStarts[1] : 0;
  const lineNumberAtAddress = (address: number) => word(address - base + 2);

  return lineStarts.map((start) => ({ number: word(start + 2), text: detokenizeLine(bytes, start + 4, lineNumberAtAddress) }));
}

/**
 * A 0x00 inside a line can be part of a number's bytes; walk the tokens from the
 * line start to tell a real terminator from a zero byte in a constant.
 */
function isLineEnd(bytes: Uint8Array, lineStart: number, candidate: number): boolean {
  let at = lineStart + 4;
  let literal = false;
  let quoted = false;
  while (at < candidate) {
    const b = bytes[at];
    if (quoted) {
      if (b === 0x22) quoted = false;
      at++;
      continue;
    }
    if (literal) {
      at++;
      continue;
    }
    if (b === 0x22) quoted = true;
    else if (b === REM || b === APOSTROPHE) literal = true;
    at += 1 + operandLength(b, bytes[at + 1]);
  }
  return at === candidate;
}

function operandLength(token: number, next: number): number {
  switch (token) {
    case 0x0b:
    case 0x0c:
    case 0x0d:
    case 0x0e:
    case 0x1c:
      return 2;
    case 0x0f:
      return 1;
    case 0x1d:
      return 4;
    case 0x1f:
      return 8;
    case 0xfd:
    case 0xfe:
    case 0xff:
      return next === undefined ? 0 : 1;
    default:
      return 0;
  }
}

function detokenizeLine(bytes: Uint8Array, start: number, lineAt: (address: number) => number): string {
  let out = "";
  let at = start;
  let quoted = false;
  let inData = false;
  while (at < bytes.length) {
    const b = bytes[at];
    if (b === 0 && !quoted) break;
    if (quoted) {
      out += String.fromCharCode(b);
      if (b === 0x22) quoted = false;
      at++;
      continue;
    }
    if (b === 0x22) {
      quoted = true;
      out += '"';
      at++;
      continue;
    }
    if (inData) {
      if (b === 0x3a) inData = false;
      out += String.fromCharCode(b);
      at++;
      continue;
    }
    // ":ELSE" and ":REM'" are stored with a colon the listing doesn't show.
    if (b === 0x3a && bytes[at + 1] === ELSE) {
      at++;
      continue;
    }
    if (b === 0x3a && bytes[at + 1] === REM && bytes[at + 2] === APOSTROPHE) {
      at += 2;
      continue;
    }
    if (b === REM || b === APOSTROPHE) {
      out += KEYWORDS[b];
      at++;
      while (at < bytes.length && bytes[at] !== 0) out += String.fromCharCode(bytes[at++]);
      break;
    }
    if (b >= 0x11 && b <= 0x1b) {
      out += String(b - 0x11);
      at++;
      continue;
    }
    switch (b) {
      case 0x0b:
        out += `&O${(bytes[at + 1] | (bytes[at + 2] << 8)).toString(8)}`;
        at += 3;
        continue;
      case 0x0c:
        out += `&H${(bytes[at + 1] | (bytes[at + 2] << 8)).toString(16).toUpperCase()}`;
        at += 3;
        continue;
      case 0x0d:
        out += String(lineAt(bytes[at + 1] | (bytes[at + 2] << 8)));
        at += 3;
        continue;
      case 0x0e:
        out += String(bytes[at + 1] | (bytes[at + 2] << 8));
        at += 3;
        continue;
      case 0x0f:
        out += String(bytes[at + 1]);
        at += 2;
        continue;
      case 0x1c: {
        const raw = bytes[at + 1] | (bytes[at + 2] << 8);
        out += String(raw >= 0x8000 ? raw - 0x10000 : raw);
        at += 3;
        continue;
      }
      case 0x1d:
        out += formatNumber(mbf(bytes.subarray(at + 1, at + 5)), 7, "!");
        at += 5;
        continue;
      case 0x1f:
        out += formatNumber(mbf(bytes.subarray(at + 1, at + 9)), 16, "#");
        at += 9;
        continue;
      case 0xfd:
        out += CONVERSIONS[bytes[at + 1]] ?? `<FD ${bytes[at + 1].toString(16)}>`;
        at += 2;
        continue;
      case 0xfe:
        out += STATEMENTS[bytes[at + 1]] ?? `<FE ${bytes[at + 1].toString(16)}>`;
        at += 2;
        continue;
      case 0xff:
        out += FUNCTIONS[bytes[at + 1]] ?? `<FF ${bytes[at + 1].toString(16)}>`;
        at += 2;
        continue;
    }
    if (b >= 0x80) {
      out += KEYWORDS[b] ?? `<${b.toString(16)}>`;
      if (b === DATA) inData = true;
      at++;
      continue;
    }
    out += String.fromCharCode(b);
    at++;
  }
  return out;
}

export function listing(lines: ListingLine[]): string {
  return lines.map((line) => `${line.number} ${line.text}`).join("\n") + "\n";
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/detokenize-gwbasic.ts");
if (isMain) {
  const [input, output] = process.argv.slice(2);
  if (!input) {
    console.error("usage: npx tsx scripts/detokenize-gwbasic.ts <program.bas> [listing.txt]");
    process.exit(1);
  }
  const text = listing(detokenize(new Uint8Array(readFileSync(input))));
  if (output) writeFileSync(output, text);
  else process.stdout.write(text);
}
