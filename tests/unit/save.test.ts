import { beforeEach, describe, expect, it, vi } from "vitest";

type SaveModule = typeof import("@/lib/kit/save");

async function freshSave(): Promise<SaveModule> {
  vi.resetModules();
  return import("@/lib/kit/save");
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("createStore", () => {
  it("starts from the defaults and saves a versioned envelope", async () => {
    const { createStore } = await freshSave();
    const store = createStore("demo", { version: 3, defaults: { coins: 0 } });
    expect(store.get()).toEqual({ coins: 0 });
    store.set((s) => ({ coins: s.coins + 5 }));
    expect(JSON.parse(localStorage.getItem("anykey.demo.save")!)).toEqual({ version: 3, data: { coins: 5 } });
  });

  it("runs every migration between the saved version and this one, in order", async () => {
    localStorage.setItem("anykey.demo.save", JSON.stringify({ version: 1, data: { gold: 2 } }));
    const { createStore } = await freshSave();
    const store = createStore<{ coins: number; gems: number }>("demo", {
      version: 3,
      defaults: { coins: 0, gems: 0 },
      migrations: {
        2: (old) => ({ coins: (old as { gold: number }).gold * 10 }),
        3: (old) => ({ ...(old as object), gems: 1 }),
      },
    });
    expect(store.get()).toEqual({ coins: 20, gems: 1 });
    expect(JSON.parse(localStorage.getItem("anykey.demo.save")!).version).toBe(3);
  });

  it("reads a legacy key once and leaves it untouched", async () => {
    const legacy = JSON.stringify({ gold: 4 });
    localStorage.setItem("old.demo.v1", legacy);
    const { createStore } = await freshSave();
    const store = createStore<{ coins: number }>("demo", {
      version: 2,
      defaults: { coins: 0 },
      legacy: { key: "old.demo.v1", version: 1 },
      migrations: { 2: (old) => ({ coins: (old as { gold: number }).gold }) },
    });
    expect(store.get()).toEqual({ coins: 4 });
    expect(localStorage.getItem("old.demo.v1")).toBe(legacy);

    store.set({ coins: 9 });
    const again = (await freshSave()).createStore<{ coins: number }>("demo", {
      version: 2,
      defaults: { coins: 0 },
      legacy: { key: "old.demo.v1", version: 1 },
      migrations: { 2: (old) => ({ coins: (old as { gold: number }).gold }) },
    });
    expect(again.get()).toEqual({ coins: 9 });
  });

  it("falls back to the defaults when the save is not JSON", async () => {
    localStorage.setItem("anykey.demo.save", "{not json");
    const { createStore } = await freshSave();
    expect(createStore("demo", { version: 1, defaults: { coins: 1 } }).get()).toEqual({ coins: 1 });
  });

  it("keeps working in memory when the browser refuses to store", async () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    const { createStore, storage } = await freshSave();
    const store = createStore("demo", { version: 1, defaults: { coins: 0 } });
    store.set({ coins: 3 });
    expect(store.get()).toEqual({ coins: 3 });
    expect(storage.read("anykey.demo.save")).toContain('"coins":3');
  });

  it("forgets its save and its legacy key", async () => {
    localStorage.setItem("old.demo.v1", "{}");
    const { createStore } = await freshSave();
    const store = createStore("demo", { version: 2, defaults: { coins: 0 }, legacy: { key: "old.demo.v1", version: 1 } });
    store.set({ coins: 7 });
    const heard = vi.fn();
    store.subscribe(heard);
    store.forget();
    expect(localStorage.getItem("anykey.demo.save")).toBeNull();
    expect(localStorage.getItem("old.demo.v1")).toBeNull();
    expect(store.get()).toEqual({ coins: 0 });
    expect(heard).toHaveBeenCalled();
  });

  it("initialises only an empty key, quietly", async () => {
    const { createStore } = await freshSave();
    const store = createStore("demo", { version: 1, defaults: { coins: 0 } });
    const heard = vi.fn();
    store.subscribe(heard);
    expect(store.initialise({ coins: 2 })).toBe(true);
    expect(store.initialise({ coins: 5 })).toBe(false);
    expect(store.get()).toEqual({ coins: 2 });
    expect(heard).not.toHaveBeenCalled();
  });
});
