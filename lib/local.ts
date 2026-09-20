// Everything a follower keeps, in their own browser and nowhere else.
//
// The evidence says the decision takes days and often ends somewhere else, so
// people need to be able to leave and come back. That needs memory. It does
// not need an account, so this is localStorage and only references live here.
// Item ids, question tokens and the call at the time of saving. Never the
// answer itself, because the answer can change and theirs would go stale.

export type SavedItem = {
  itemId: string;
  name: string;
  call: string; // what it said when they saved it
  // The job the saved card belonged to. Without it the call gets compared
  // against a different group and a match reads as her changing her mind.
  job: string;
  // Their own answers, kept so the saved call can be compared like for like
  // when they come back. Never sent anywhere except to re-run their own
  // verdict.
  context: Record<string, unknown>;
  savedAt: string;
};

export type MyQuestion = {
  ref: string;
  path: string;
  itemId: string;
  itemName: string;
  askedAt: string;
};

const KEYS = {
  questions: "asksofia.mine.v1",
  saved: "asksofia.saved.v1",
  seen: "asksofia.seen.v1",
  checkins: "asksofia.checkins.v1",
};

const LIMIT = 30;

function readRaw(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "[]";
  } catch {
    // Private windows and blocked storage both land here. Nothing breaks.
    return "[]";
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("asksofia:local"));
  } catch {
    // Not being able to remember is not worth an error in front of anyone.
  }
}

function parse<T>(raw: string): T[] {
  try {
    const out = JSON.parse(raw);
    return Array.isArray(out) ? (out as T[]) : [];
  } catch {
    return [];
  }
}

export function snapshot(key: keyof typeof KEYS): string {
  return readRaw(KEYS[key]);
}

export function subscribe(onChange: () => void): () => void {
  window.addEventListener("asksofia:local", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("asksofia:local", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export const questions = {
  all: () => parse<MyQuestion>(readRaw(KEYS.questions)),
  add(entry: MyQuestion) {
    const next = [entry, ...this.all().filter((q) => q.ref !== entry.ref)];
    write(KEYS.questions, next.slice(0, LIMIT));
  },
};

export const saved = {
  all: () => parse<SavedItem>(readRaw(KEYS.saved)),
  has(itemId: string) {
    return this.all().some((s) => s.itemId === itemId);
  },
  toggle(entry: SavedItem): boolean {
    const current = this.all();
    const already = current.some((s) => s.itemId === entry.itemId);
    const next = already
      ? current.filter((s) => s.itemId !== entry.itemId)
      : [entry, ...current].slice(0, LIMIT);
    write(KEYS.saved, next);
    return !already;
  },
};

// A visit is only a return visit if they have been here before, which is the
// whole point of asking whether they bought it.
export const seen = {
  all: () => parse<string>(readRaw(KEYS.seen)),
  isReturn(itemId: string) {
    return this.all().includes(itemId);
  },
  mark(itemId: string) {
    const current = this.all();
    if (current.includes(itemId)) return;
    write(KEYS.seen, [itemId, ...current].slice(0, 100));
  },
};

export const checkins = {
  all: () => parse<string>(readRaw(KEYS.checkins)),
  answered(itemId: string) {
    return this.all().includes(itemId);
  },
  mark(itemId: string) {
    const current = this.all();
    if (current.includes(itemId)) return;
    write(KEYS.checkins, [itemId, ...current].slice(0, 100));
  },
};
