import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { marked } from "marked";
import type { DocTab } from "@/components/kit/Story";

/** The four chapters every Any Key program ships with, in reading order. */
const CHAPTERS = [
  { id: "about", label: "About the original", file: "ABOUT.md" },
  { id: "howto", label: "How it was used", file: "HOW-TO.md" },
  { id: "original", label: "How it worked", file: "ORIGINAL-ARCHITECTURE.md" },
  { id: "port", label: "How we rebuilt it", file: "PORT-ARCHITECTURE.md" },
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
