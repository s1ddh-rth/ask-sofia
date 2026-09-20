"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  snapshot,
  subscribe,
  type MyQuestion,
  type SavedItem,
} from "@/lib/local";

// One panel for everything they are carrying: pieces they saved and questions
// they asked. Both live in this browser only, which is the whole point. The
// evidence says the decision takes days, so leaving and coming back has to
// work without an account.

export default function MyStuff({
  callLabels,
}: {
  callLabels: Record<string, string>;
}) {
  const savedRaw = useSyncExternalStore(
    subscribe,
    () => snapshot("saved"),
    () => "[]",
  );
  const questionsRaw = useSyncExternalStore(
    subscribe,
    () => snapshot("questions"),
    () => "[]",
  );

  const mySaved = useMemo<SavedItem[]>(() => {
    try {
      const v = JSON.parse(savedRaw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }, [savedRaw]);

  const myQuestions = useMemo<MyQuestion[]>(() => {
    try {
      const v = JSON.parse(questionsRaw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }, [questionsRaw]);

  const [answered, setAnswered] = useState<string[]>([]);
  const [changed, setChanged] = useState<string[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [ranked, setRanked] = useState<
    Array<{ itemId: string; call: string }> | null
  >(null);

  // One request for both lists. Only things they already hold go out.
  useEffect(() => {
    if (mySaved.length === 0 && myQuestions.length === 0) return;
    let live = true;
    fetch("/api/mine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        refs: myQuestions.map((q) => q.ref),
        items: mySaved.map((s) => ({
          itemId: s.itemId,
          call: s.call,
          context: s.context,
        })),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d) return;
        if (Array.isArray(d.answered)) setAnswered(d.answered);
        if (Array.isArray(d.current)) {
          setChanged(
            d.current
              .filter((c: { changed: boolean }) => c.changed)
              .map((c: { itemId: string }) => c.itemId),
          );
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [mySaved, myQuestions]);

  async function helpMeChoose() {
    setChoosing(true);
    try {
      const res = await fetch("/api/choose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: mySaved.map((s) => ({ itemId: s.itemId, context: s.context })),
        }),
      });
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d?.ranked)) setRanked(d.ranked);
      }
    } catch {
      // Nothing to show is better than an error.
    } finally {
      setChoosing(false);
    }
  }

  if (mySaved.length === 0 && myQuestions.length === 0) return null;

  const isAnswered = new Set(answered);
  const hasChanged = new Set(changed);

  return (
    <section className="mt-10 border-t border-ink/10 pt-6">
      <p className="label">What you are carrying</p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        Kept in this browser only. No account, nothing about you stored
        anywhere else.
      </p>

      {mySaved.length > 0 ? (
        <div className="mt-4">
          <p className="label">Your shortlist</p>
          <ul className="mt-2 space-y-2">
            {mySaved.map((s) => (
              <li key={s.itemId}>
                <a
                  href={`/s/${s.itemId}`}
                  className="block rounded-sm border border-ink/10 bg-card px-3 py-2"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[15px]">
                      {s.name}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                      {callLabels[s.call] ?? s.call}
                    </span>
                  </span>
                  {hasChanged.has(s.itemId) ? (
                    <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-rust">
                      Sofia has updated this since you saved it
                    </span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>

          {mySaved.length >= 2 ? (
            <>
              <button
                type="button"
                onClick={helpMeChoose}
                disabled={choosing}
                className="mt-3 w-full rounded-sm bg-ink px-4 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-card disabled:opacity-50"
              >
                {choosing ? "Thinking" : "Help me choose"}
              </button>

              {ranked ? (
                <ol className="mt-3 space-y-1 rounded-sm border border-rust/40 bg-rust/5 p-3">
                  {ranked.map((r, i) => (
                    <li key={r.itemId} className="text-[15px]">
                      <span className="font-mono text-[11px] text-muted">
                        {i + 1}.{" "}
                      </span>
                      {mySaved.find((s) => s.itemId === r.itemId)?.name ??
                        r.itemId}
                      <span className="label"> {callLabels[r.call] ?? r.call}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {myQuestions.length > 0 ? (
        <div className="mt-5">
          <p className="label">Your questions</p>
          <ul className="mt-2 space-y-2">
            {myQuestions.map((q) => (
              <li key={q.ref}>
                <a
                  href={q.path}
                  className="flex items-baseline justify-between gap-3 rounded-sm border border-ink/10 bg-card px-3 py-2"
                >
                  <span className="min-w-0 truncate text-[15px]">
                    {q.itemName}
                  </span>
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
        </div>
      ) : null}
    </section>
  );
}
