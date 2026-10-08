import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { marked } from "marked";
import type { DocTab } from "@/components/kit/Story";

/**
 * The six chapters every Any Key game ships with (docs/templates/), in
 * reading order: the game, then the original, then how the one became the other.
 * The shell opens "howtoplay" as the pause menu's How to play.
 */
const CHAPTERS = [
  { id: "about", label: "About", file: "ABOUT.md" },
  { id: "howtoplay", label: "How to play", file: "HOW-TO-PLAY.md" },
  { id: "original", label: "How the original worked", file: "ORIGINAL-ARCHITECTURE.md" },
  { id: "changes", label: "What we changed", file: "CHANGES-FROM-ORIGINAL.md" },
  { id: "architecture", label: "How we rebuilt it", file: "ARCHITECTURE.md" },
  { id: "notes", label: "Notes", file: "NOTES.md" },
];

/** Reads docs/<program>/*.md at build time and renders them for the Story tab. */
export async function loadProgramDocs(program: string): Promise<DocTab[]> {
  const docs: DocTab[] = [];
  for (const chapter of CHAPTERS) {
    try {
      const markdown = await readFile(join(process.cwd(), "docs", program, chapter.file), "utf8");
      let html = await marked.parse(markdown);
      // Links between the docs become links between the Story chapters.
      for (const other of CHAPTERS) html = html.replaceAll(`href="${other.file}`, `href="#chapter-${other.id}`);
      docs.push({ id: chapter.id, label: chapter.label, html });
    } catch {
      // A chapter that isn't written yet simply doesn't show.
    }
  }
  return docs;
}
