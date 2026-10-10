"use client";

import { answer, type AiAnswer, type AiRequest } from "@/lib/long-memory/thinking";

/*
 * Asks the thinking worker a question and waits for the answer. If workers
 * are unavailable, the same code runs on the main thread a moment later.
 */

let worker: Worker | null = null;
let failed = false;
let nextId = 1;
const waiting = new Map<number, { resolve: (a: AiAnswer) => void; reject: (e: Error) => void }>();

function getWorker() {
  if (worker || failed || typeof Worker === "undefined") return worker;
  try {
    worker = new Worker(new URL("../../lib/long-memory/ai.worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event: MessageEvent<{ id: number; answer?: AiAnswer; error?: string }>) => {
      const job = waiting.get(event.data.id);
      if (!job) return;
      waiting.delete(event.data.id);
      if (event.data.error) job.reject(new Error(event.data.error));
      else job.resolve(event.data.answer!);
    });
    worker.addEventListener("error", () => {
      failed = true;
      worker = null;
      for (const [id, job] of waiting) {
        waiting.delete(id);
        job.reject(new Error("worker failed"));
      }
    });
  } catch {
    failed = true;
    worker = null;
  }
  return worker;
}

export function ask(request: AiRequest): Promise<AiAnswer> {
  const w = getWorker();
  if (!w) {
    return new Promise((resolve, reject) =>
      window.setTimeout(() => {
        try {
          resolve(answer(request));
        } catch (error) {
          reject(error as Error);
        }
      }, 16),
    );
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    w.postMessage({ id, request });
  }).catch(() => answer(request)) as Promise<AiAnswer>;
}

export const askPit = async (request: AiRequest) => ((await ask(request)) as { pit: number }).pit;
