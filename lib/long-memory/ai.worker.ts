/*
 * The thinking worker: answers `thinking.ts` questions off the main thread.
 * Every request carries an id; the answer comes back with it.
 */

import { answer, type AiRequest } from "./thinking";

type Envelope = { id: number; request: AiRequest };

self.addEventListener("message", (event: MessageEvent<Envelope>) => {
  const { id, request } = event.data;
  try {
    self.postMessage({ id, answer: answer(request) });
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
});
