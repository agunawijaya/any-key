/*
 * Versioned, namespaced saves.
 *
 * Every game keeps one store under `anykey.<gameId>.save`, holding
 * `{ version, data }`. When the data was written by an older version, the
 * game's migrations bring it up to date one step at a time. A store can also
 * name a legacy key from before the kit: it is read once, when nothing is
 * saved under the new key, and never written or deleted by a migration, so
 * going back to an older build still finds the old progress.
 *
 * Storage can fail (private windows, full quota, server rendering). Every
 * access is guarded, and when the browser refuses, saves live in memory for
 * the rest of the visit.
 */

const PREFIX = "anykey.";

export const saveKey = (gameId: string) => `${PREFIX}${gameId}.save`;

const memory = new Map<string, string>();
let browserRefused = false;

function browserStorage(): Storage | null {
  if (typeof window === "undefined" || browserRefused) return null;
  try {
    return window.localStorage;
  } catch {
    browserRefused = true;
    return null;
  }
}

/** Raw string access, with the in-memory fallback. */
export const storage = {
  read(key: string): string | null {
    // A write the browser refused lives in memory and is newer than anything stored.
    if (memory.has(key)) return memory.get(key)!;
    const local = browserStorage();
    if (local) {
      try {
        return local.getItem(key);
      } catch {
        browserRefused = true;
      }
    }
    return null;
  },
  write(key: string, value: string) {
    const local = browserStorage();
    if (local) {
      try {
        local.setItem(key, value);
        memory.delete(key);
        return;
      } catch {
        // Quota or privacy settings: keep it for this visit.
      }
    }
    memory.set(key, value);
  },
  remove(key: string) {
    memory.delete(key);
    const local = browserStorage();
    try {
      local?.removeItem(key);
    } catch {
      // Nothing more we can do; the memory copy is gone either way.
    }
  },
  /** Every key this app has written, in storage or in memory. */
  keys(): string[] {
    const found = new Set(memory.keys());
    const local = browserStorage();
    try {
      for (let i = 0; local && i < local.length; i++) {
        const key = local.key(i);
        if (key?.startsWith(PREFIX)) found.add(key);
      }
    } catch {
      // A refused enumeration leaves the memory keys.
    }
    return [...found];
  },
};

function readJson(key: string): unknown {
  const raw = storage.read(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export type Migration = (older: unknown) => unknown;

export type StoreOptions<T> = {
  /** The shape version this build writes. Start at 1; raise it when the shape changes. */
  version: number;
  defaults: T;
  /** `migrations[n]` turns data saved at version n - 1 into version n. */
  migrations?: Record<number, Migration>;
  /** A key from before the kit and the version its data counts as. */
  legacy?: { key: string; version: number };
  /** Fills in fields a newer build added and drops values this build doesn't know. */
  normalise?: (data: T) => T;
};

export type Store<T> = {
  readonly gameId: string;
  readonly key: string;
  readonly legacyKey?: string;
  readonly defaults: T;
  get(): T;
  set(update: T | ((current: T) => T)): T;
  /** Back to the defaults, saved. */
  reset(): void;
  /** Deletes the save and its legacy key; nothing is written until the next change. */
  forget(): void;
  /**
   * Saves `value` as the first data under this key, if nothing is saved yet.
   * Quiet: listeners are not called, so it is safe while React renders.
   */
  initialise(value: T): boolean;
  subscribe(listener: () => void): () => void;
};

type Envelope = { version: number; data: unknown };

const isEnvelope = (value: unknown): value is Envelope =>
  typeof value === "object" && value !== null && "version" in value && "data" in value && typeof (value as Envelope).version === "number";

/** Runs the migrations from `from` up to `to`; a missing step keeps the data as it is. */
export function migrate(data: unknown, from: number, to: number, migrations: Record<number, Migration> = {}): unknown {
  let current = data;
  for (let version = from + 1; version <= to; version++) {
    const step = migrations[version];
    if (step) current = step(current);
  }
  return current;
}

const stores = new Map<string, Store<unknown> & { reload(): void }>();

export function createStore<T>(gameId: string, options: StoreOptions<T>): Store<T> {
  const key = saveKey(gameId);
  const { version, defaults, migrations, legacy } = options;
  const normalise = options.normalise ?? ((data: T) => ({ ...defaults, ...data }));
  const listeners = new Set<() => void>();
  let current: T = defaults;
  let loaded = false;

  function load(): T {
    const saved = readJson(key);
    if (isEnvelope(saved)) {
      const data = saved.version < version ? migrate(saved.data, saved.version, version, migrations) : saved.data;
      const value = normalise(data as T);
      if (saved.version < version) write(value);
      return value;
    }
    const old = legacy ? readJson(legacy.key) : undefined;
    if (old !== undefined && legacy) {
      const value = normalise(migrate(old, legacy.version, version, migrations) as T);
      write(value);
      return value;
    }
    return defaults;
  }

  function write(value: T) {
    storage.write(key, JSON.stringify({ version, data: value } satisfies Envelope));
  }

  function notify() {
    listeners.forEach((listener) => listener());
  }

  const store = {
    gameId,
    key,
    legacyKey: legacy?.key,
    defaults,
    get() {
      // On the server there is no storage: render the defaults, load in the browser.
      if (typeof window === "undefined") return defaults;
      if (!loaded) {
        current = load();
        loaded = true;
      }
      return current;
    },
    set(update: T | ((value: T) => T)) {
      const next = typeof update === "function" ? (update as (value: T) => T)(store.get()) : update;
      current = next;
      loaded = true;
      write(next);
      notify();
      return next;
    },
    reset() {
      store.set(defaults);
    },
    forget() {
      storage.remove(key);
      if (legacy) storage.remove(legacy.key);
      current = defaults;
      loaded = true;
      notify();
    },
    initialise(value: T) {
      if (storage.read(key) !== null) return false;
      write(value);
      if (loaded) current = value;
      return true;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Picks up a change another tab made. */
    reload() {
      if (!loaded) return;
      current = load();
      notify();
    },
  };
  stores.set(key, store as unknown as Store<unknown> & { reload(): void });
  return store;
}

/** A loaded store by game id, if this page has created one. */
export const storeFor = (gameId: string) => stores.get(saveKey(gameId));

/**
 * Deletes a save by key, whether or not its store is loaded on this page,
 * so the Keyring settings can forget a game without loading the game.
 */
export function forgetSave(gameId: string, legacyKey?: string) {
  const loaded = storeFor(gameId);
  if (loaded) loaded.forget();
  storage.remove(saveKey(gameId));
  if (legacyKey) storage.remove(legacyKey);
}

// Another tab saved: reload the stores this page has open, so two tabs never overwrite each other's progress.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key && stores.has(event.key)) stores.get(event.key)!.reload();
  });
}
