"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Story.module.css";

export type DocTab = { id: string; label: string; html: string };

/** The game's six docs, rendered in the app. Mermaid diagrams are drawn on demand. */
export function Story({ docs, chapter }: { docs: DocTab[]; chapter?: string }) {
  const [active, setActive] = useState(chapter ?? docs[0]?.id);
  const bodyRef = useRef<HTMLDivElement>(null);
  const doc = docs.find((d) => d.id === active) ?? docs[0];

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const blocks = Array.from(body.querySelectorAll<HTMLElement>("pre > code.language-mermaid"));
    if (!blocks.length) return;
    let cancelled = false;
    (async () => {
      const mermaid = (await import("mermaid")).default;
      const dark = document.documentElement.dataset.theme === "dark";
      mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "neutral", fontFamily: "var(--font-sans)", securityLevel: "strict" });
      for (const [i, code] of blocks.entries()) {
        if (cancelled) return;
        try {
          const { svg } = await mermaid.render(`diagram-${active}-${i}`, code.textContent ?? "");
          const figure = document.createElement("figure");
          figure.className = styles.diagram;
          figure.innerHTML = svg;
          code.parentElement?.replaceWith(figure);
        } catch {
          code.parentElement?.classList.add(styles.diagramFallback);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  function onClick(event: React.MouseEvent) {
    const link = (event.target as HTMLElement).closest("a");
    const match = link?.getAttribute("href")?.match(/^#chapter-([a-z]+)/);
    if (!match) return;
    event.preventDefault();
    setActive(match[1]);
    window.scrollTo({ top: 0 });
  }

  if (!doc) return null;
  return (
    <div className={styles.story}>
      <nav className={styles.toc} aria-label="Story chapters">
        {docs.map((d, i) => (
          <button key={d.id} type="button" aria-pressed={d.id === doc.id} onClick={() => setActive(d.id)}>
            <span className={styles.num}>0{i + 1}</span>
            {d.label}
          </button>
        ))}
      </nav>
      <article key={doc.id} ref={bodyRef} className={styles.body} onClick={onClick} dangerouslySetInnerHTML={{ __html: doc.html }} />
    </div>
  );
}
