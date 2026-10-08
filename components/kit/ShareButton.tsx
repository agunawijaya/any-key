"use client";

import { useEffect, useState } from "react";
import { shareText, type ShareOutcome } from "@/lib/kit/share";

type Props = {
  text: string;
  /** The button's resting label: "Share", "Share result", "Copy to share". */
  label?: string;
  className?: string;
};

const CONFIRMATION: Partial<Record<ShareOutcome, string>> = { copied: "Copied", shared: "Shared", failed: "Couldn't copy" };

/** Shares a result (system sheet on touch devices, clipboard on desktops) and says what happened. */
export function ShareButton({ text, label = "Share", className }: Props) {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);

  useEffect(() => {
    if (!outcome) return;
    const timer = window.setTimeout(() => setOutcome(null), 2400);
    return () => window.clearTimeout(timer);
  }, [outcome]);

  const said = outcome ? CONFIRMATION[outcome] : undefined;
  return (
    <button type="button" className={className} onClick={async () => setOutcome(await shareText(text))} data-outcome={outcome ?? undefined}>
      <span aria-live="polite">{said ?? label}</span>
    </button>
  );
}
