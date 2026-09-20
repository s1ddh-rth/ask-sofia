"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

// Everything a follower keeps lives here, in their own browser and nowhere
// else. No account, no email, nothing on our side that ties a link to a
// person. If they clear their browser it is gone, which is the trade and is
// said plainly on screen.

const KEY = "asksofia.mine.v1";
const LIMIT = 20;

export type MyQuestion = {
  ref: string;
  path: string;
  itemId: string;
  itemName: string;
  askedAt: string;
};

// The raw string, because a snapshot has to be stable between renders and a
// fresh array never is.
function rawSnapshot(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "[]";
  } catch {
    // Private windows and blocked storage both land here. Nothing breaks.
    return "[]";
  }
}

function read(): MyQuestion[] {
  try {
    const parsed = JSON.parse(rawSnapshot());
    return Array.isArray(parsed) ? (parsed as MyQuestion[]) : [];
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("asksofia:mine", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("asksofia:mine", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function remember(entry: MyQuestion) {
  try {
    const next = [entry, ...read().filter((q) => q.ref !== entry.ref)].slice(
      0,
      LIMIT,
    );
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("asksofia:mine"));
  } catch {
    // Not being able to remember is not worth an error in front of anyone.
  }
}

export default function MyQuestions() {
  // The server has no localStorage, so it renders nothing and the browser
  // fills it in. That also keeps the two from ever disagreeing.
  const raw = useSyncExternalStore(subscribe, rawSnapshot, () => "[]");
  const mine = useMemo<MyQuestion[]>(() => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [raw]);
  const [answered, setAnswered] = useState<string[]>([]);

  // Asks only which of their own links she has answered. Nothing about them
  // is sent, and a failure just leaves everything reading as waiting.
  useEffect(() => {
    const refs = mine.map((q) => q.ref);
    if (refs.length === 0) return;
    let live = true;
    fetch("/api/mine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refs }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && Array.isArray(d?.answered)) setAnswered(d.answered);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [mine]);

  if (mine.length === 0) return null;

  const isAnswered = new Set(answered);

  return (
    <section className="mt-10 border-t border-ink/10 pt-6">
      <p className="label">Your questions</p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        Kept in this browser only. No account, nothing about you stored
        anywhere else.
      </p>
      <ul className="mt-3 space-y-2">
        {mine.map((q) => (
          <li key={q.ref}>
            <a
              href={q.path}
              className="flex items-baseline justify-between gap-3 rounded-sm border border-ink/10 bg-card px-3 py-2"
            >
              <span className="min-w-0 truncate text-[15px]">{q.itemName}</span>
              <span
                className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] ${
                  isAnswered.has(q.ref) ? "text-rust" : "text-muted"
                }`}
              >
                {isAnswered.has(q.ref) ? "Answered" : "Waiting"}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
