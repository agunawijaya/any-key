import { setMaxListeners } from "node:events";

/*
 * Just enough of a browser for the kit: a window that is an event target, a
 * localStorage, and matchMedia. Tests clear the storage and reset the module
 * registry before each case, so every case starts like a first visit.
 */

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

const localStorage = new MemoryStorage();
const browserWindow = Object.assign(new EventTarget(), {
  localStorage,
  matchMedia: (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }),
});

// Every fresh import of the kit adds a storage listener; that is expected here.
setMaxListeners(0, browserWindow);

Object.assign(globalThis, { window: browserWindow, localStorage });
