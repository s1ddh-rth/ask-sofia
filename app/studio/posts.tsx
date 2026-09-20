"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type PostView = {
  id: string;
  title: string;
  views: number | null;
  purchases: number | null;
  item_ids: string[] | null;
  status: string;
  perThousand: number;
  quietWinner: boolean;
  itemNames: string[];
};

export default function Posts({
  posts,
  threshold,
}: {
  posts: PostView[];
  threshold: number;
}) {
  const router = useRouter();
  const [running, setRunning] = useState<"backfill" | "nightly" | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  async function run(mode: "backfill" | "nightly") {
    setRunning(mode);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "backfill"
            ? { mode: "backfill", months: 12 }
            : { mode: "nightly", since: lastRun },
        ),
      });
      if (res.ok) {
        const d = await res.json().catch(() => null);
        if (d?.ranAt) setLastRun(d.ranAt);
      }
      router.refresh();
    } catch {
      // Nothing here is worth an error in front of her.
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="mt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <button
            type="button"
            onClick={() => run("backfill")}
            disabled={running !== null}
            className="w-full rounded-sm bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-card disabled:opacity-40"
          >
            {running === "backfill" ? "Running" : "Run 12-month backfill"}
          </button>
          <p className="label mt-2 leading-relaxed">
            In production this runs once when she connects her account, and
            pulls the last twelve months, which is as far back as the metrics
            go.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => run("nightly")}
            disabled={running !== null}
            className="w-full rounded-sm border border-ink/20 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink disabled:opacity-40"
          >
            {running === "nightly" ? "Running" : "Run nightly sync"}
          </button>
          <p className="label mt-2 leading-relaxed">
            In production this runs every night, taking anything new plus the
            last two days again, because insights can lag by 48 hours.
          </p>
        </div>
      </div>

      {posts.length === 0 ? (
        <p className="mt-3 rounded-sm border border-ink/10 bg-card px-4 py-6 text-[15px] text-muted">
          Nothing synced yet. Either run reads her posts and flags the ones
          selling quietly, at {threshold} or more purchases per thousand
          views. Everything it finds is a draft until you confirm which piece
          it shows.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {posts.map((p) => (
            <li
              key={p.id}
              className={`rounded-sm border bg-card p-4 ${
                p.quietWinner ? "border-rust/50" : "border-ink/10"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-heading text-lg font-semibold uppercase leading-tight">
                  {p.title}
                </h3>
                <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                  {p.status}
                </span>
              </div>

              <p className="label mt-1">
                {(p.views ?? 0).toLocaleString("en-GB")} views /{" "}
                {(p.purchases ?? 0).toLocaleString("en-GB")} bought /{" "}
                {p.perThousand} per thousand
              </p>

              {p.quietWinner ? (
                <p className="mt-2 border-l-2 border-rust pl-3 text-[15px]">
                  Quiet winner. Fewer people saw this than your big posts and
                  far more of them bought.
                </p>
              ) : null}

              {p.itemNames.length > 0 ? (
                <p className="mt-2 text-[15px] text-ink/80">
                  Matched to {p.itemNames.join(", ")}.
                </p>
              ) : (
                <p className="mt-2 text-[15px] text-muted">
                  No piece matched. A post shows what you wore, not what you
                  think, so this stays a draft until you say otherwise.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
