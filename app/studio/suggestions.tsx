"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Suggestion } from "@/lib/suggest/heuristics";

export default function Suggestions({ items }: { items: Suggestion[] }) {
  if (items.length === 0) {
    return (
      <p className="mt-3 rounded-sm border border-ink/10 bg-card px-4 py-6 text-[15px] text-muted">
        Nothing to propose yet. Suggestions appear once the same question has
        been answered a few times, or once a verdict has been marked not useful
        more than once.
      </p>
    );
  }
  return (
    <ul className="mt-3 space-y-3">
      {items.map((s) => (
        <li key={s.id}>
          <Card suggestion={s} />
        </li>
      ))}
    </ul>
  );
}

function Card({ suggestion }: { suggestion: Suggestion }) {
  const router = useRouter();
  const [stage, setStage] = useState<
    "idle" | "confirm" | "saving" | "done" | "dismissed"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    if (!suggestion.patch) return;
    setStage("saving");
    setError(null);
    try {
      const res = await fetch("/api/patch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...suggestion.patch, confirmed: true }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setError(d?.detail ?? "That change was refused.");
        setStage("confirm");
        return;
      }
      setStage("done");
      router.refresh();
    } catch {
      setError("Could not save. Try once more.");
      setStage("confirm");
    }
  }

  if (stage === "dismissed") return null;

  return (
    <div className="rounded-sm border border-ink/10 bg-card p-4">
      <p className="label">
        {suggestion.kind === "needs-review" ? "Worth a look" : "Proposal"}
      </p>
      <h3 className="font-heading mt-1 text-xl font-semibold uppercase leading-tight">
        {suggestion.headline}
      </h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink/80">
        {suggestion.because}
      </p>

      {stage === "done" ? (
        <p className="mt-3 border-l-2 border-rust pl-3 text-[15px]">
          Saved. That is in the data now, and it shows up in the history.
        </p>
      ) : suggestion.patch ? (
        stage === "confirm" || stage === "saving" ? (
          <div className="mt-3 rounded-sm border border-rust/40 bg-rust/5 p-3">
            <p className="label">Exactly what this changes</p>
            <pre className="mt-1 overflow-x-auto font-mono text-[11px] leading-relaxed">
              {suggestion.patch.target}
              {"\n"}
              {JSON.stringify(suggestion.patch.change, null, 2)}
            </pre>
            {error ? (
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-rust">
                {error}
              </p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={approve}
                disabled={stage === "saving"}
                className="rounded-sm bg-rust px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-card disabled:opacity-60"
              >
                {stage === "saving" ? "Saving" : "Approve and make live"}
              </button>
              <button
                type="button"
                onClick={() => setStage("idle")}
                className="rounded-sm border border-ink/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted"
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setStage("confirm")}
              className="rounded-sm bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-card"
            >
              See the change
            </button>
            <button
              type="button"
              onClick={() => setStage("dismissed")}
              className="rounded-sm border border-ink/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted"
            >
              Not now
            </button>
          </div>
        )
      ) : (
        <p className="mt-3 border-l-2 border-ink/20 pl-3 text-[15px] text-muted">
          Nothing is proposed automatically here, because the point is that we
          do not know what is wrong. Edit the piece below if you agree.
        </p>
      )}
    </div>
  );
}
