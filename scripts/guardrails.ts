/*
 * The collection's hard rules that a machine can check (CLAUDE.md, rules 1–3):
 *
 * - no raster images outside docs/ (screenshots) and public/soundfont/;
 * - no emoji in components/ and app/: everything on the page is drawn
 *   (share texts, which are pasted into other apps, live in lib/), nor in
 *   the six docs of each game, which the Story tab shows on the page;
 * - no runtime network requests: no http(s) URLs in the code that ships.
 *
 * Run with `npm run check:guardrails`; it exits with 1 and lists every
 * finding when a rule is broken.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const ROOT = join(__dirname, "..");
const SKIP = new Set(["node_modules", ".next", ".git", "test-results", "playwright-report", "coverage", "out"]);
const RASTER = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".ico", ".tif", ".tiff", ".heic"]);
const RASTER_ALLOWED = ["docs/", "public/soundfont/"];
const CODE = new Set([".ts", ".tsx", ".css", ".mts", ".js", ".mjs"]);
/** docs/<game>/<chapter>.md: what lib/docs.ts reads into the Story tab. */
const STORY_CHAPTER = /^docs\/(?!templates\/)[^/]+\/(ABOUT|HOW-TO-PLAY|ORIGINAL-ARCHITECTURE|CHANGES-FROM-ORIGINAL|ARCHITECTURE|NOTES)\.md$/;

/** Characters that show as emoji: those drawn as emoji by default, or any character asking for it with VS16. */
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️/u;
/** A URL in a string. XML namespaces (http://www.w3.org/...) are names, not requests. */
const URL_IN_STRING = /["'`](https?:\/\/(?!www\.w3\.org\/)[^"'`\s]+)/g;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

const rel = (path: string) => relative(ROOT, path).split(sep).join("/");

/** Comments say things; they don't ship behaviour. Blank them out, keeping line numbers. */
function withoutComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const findings: string[] = [];

function findEmoji(file: string, text: string) {
  text.split("\n").forEach((line, i) => {
    const hit = line.match(EMOJI);
    if (hit) findings.push(`emoji ${hit[0]} in ${file}:${i + 1}`);
  });
}

for (const path of walk(ROOT)) {
  const file = rel(path);
  const ext = extname(path).toLowerCase();

  if (RASTER.has(ext) && !RASTER_ALLOWED.some((dir) => file.startsWith(dir))) findings.push(`raster image outside docs/: ${file}`);

  if (STORY_CHAPTER.test(file)) findEmoji(file, readFileSync(path, "utf8"));
  if (!CODE.has(ext)) continue;
  const shipped = file.startsWith("components/") || file.startsWith("app/") || file.startsWith("lib/");
  if (!shipped) continue;
  const source = readFileSync(path, "utf8");

  if (file.startsWith("components/") || file.startsWith("app/")) findEmoji(file, source);

  withoutComments(source)
    .split("\n")
    .forEach((line, i) => {
      for (const match of line.matchAll(URL_IN_STRING)) findings.push(`network URL ${match[1]} in ${file}:${i + 1}`);
    });
}

if (findings.length) {
  console.error(`Guardrails: ${findings.length} problem${findings.length === 1 ? "" : "s"}`);
  for (const finding of findings) console.error(`  ${finding}`);
  process.exit(1);
}
console.log("Guardrails: no raster art, no emoji on the page, no network URLs.");
