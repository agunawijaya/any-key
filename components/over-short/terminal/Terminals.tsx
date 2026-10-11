"use client";

import { useHydrated } from "@/components/kit/hooks";
import type { Progress } from "@/lib/over-short/progress";
import type { Program } from "@/lib/over-short/terminal";
import ui from "../ui.module.css";
import brief from "../Briefing.module.css";
import styles from "./Terminal.module.css";

/*
 * The 1970s: the two programs Over / Short grew from, each on a terminal of
 * its time, played exactly as they ran (with every line written fresh).
 */

type Props = { progress: Progress; onOpen: (program: Program) => void; onBack: () => void };

export function Terminals({ progress, onOpen, onBack }: Props) {
  const hydrated = useHydrated();
  const record = (program: Program) => {
    const r = progress.terminals[program];
    if (!hydrated || !r.wars) return "Not played yet";
    return r.finished ? `${r.finished} ${r.finished === 1 ? "war" : "wars"} finished · best ${r.best} rounds` : `${r.wars} ${r.wars === 1 ? "war" : "wars"} begun, none finished yet`;
  };
  return (
    <section className={`${ui.panel} ${brief.brief} ${styles.choose}`} aria-labelledby="os-terminals-title">
      <button type="button" className={`${ui.quiet} ${ui.back}`} onClick={onBack}>
        ← Game menu
      </button>
      <p className={ui.kicker}>The 1970s · the programs as they ran</p>
      <h2 id="os-terminals-title" className={ui.heading}>
        Two terminals
      </h2>
      <p className={ui.lede}>
        Type an elevation, read the report, type the next. Five targets, five rounds at each, the 1973 formula and every one of its quirks, down to the round exactly 100 short that
        is called over. Both programs fight the same war every time they are loaded.
      </p>
      <div className={styles.options}>
        <button type="button" className={ui.primary} onClick={() => onOpen("gunner")} data-autofocus>
          <span className={ui.label}>
            Gunner, 1973
            <small>A teletype, in yards · {record("gunner")}</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
        <button type="button" className={ui.secondary} onClick={() => onOpen("cannoneer")}>
          <span className={ui.label}>
            Cannoneer, IBM PC
            <small>A green screen and its speaker, in metres · {record("cannoneer")}</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
