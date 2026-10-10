"use client";

import { useEffect, useState } from "react";
import { dailyDate } from "@/lib/kit/daily";
import { tenTurnsManifest } from "@/lib/ten-turns/manifest";
import type { PitPlan } from "@/lib/ten-turns/tactics";

/*
 * Today's Daily Pit. Building one solves its ground (a second or two), so it
 * happens in a worker, and the result is kept for the day in this browser.
 */

export type DailyPitInfo = { number: number; key: string; plan: PitPlan };

const CACHE_KEY = "anykey.ten-turns.daily-cache";

function cached(key: string): PitPlan | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    const saved = raw ? (JSON.parse(raw) as { key: string; plan: PitPlan }) : null;
    return saved?.key === key ? saved.plan : null;
  } catch {
    return null;
  }
}

function keep(key: string, plan: PitPlan) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ key, plan }));
  } catch {
    // Storage full or blocked: the pit is simply built again next time.
  }
}

export function useDailyPit(): { pit: DailyPitInfo | null; failed: boolean } {
  const [today] = useState(() => dailyDate(new Date(), tenTurnsManifest.daily?.epoch));
  const [plan, setPlan] = useState<PitPlan | null>(() => (typeof window === "undefined" ? null : cached(today.key)));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (plan) return;
    const worker = new Worker(new URL("../../lib/ten-turns/daily.worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event: MessageEvent<{ found?: { plan: PitPlan }; error?: string }>) => {
      if (event.data.found) {
        const titled = { ...event.data.found.plan, title: `Daily Pit #${today.number}` };
        keep(today.key, titled);
        setPlan(titled);
      } else setFailed(true);
      worker.terminate();
    });
    // A worker that can't load says so here rather than leaving the page digging for ever.
    worker.addEventListener("error", () => setFailed(true));
    worker.postMessage({ day: today.day });
    return () => worker.terminate();
  }, [plan, today]);

  return { pit: plan ? { number: today.number, key: today.key, plan } : null, failed };
}
