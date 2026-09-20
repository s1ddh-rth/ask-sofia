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
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    setSyncing(true);
    try {
      await fetch("/api/ingest", { method: "POST" });
      router.refresh();
    } catch {
      // Nothing here is worth an error in front of her.
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={sync}
        disabled={syncing}
        className="rounded-sm bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-card disabled:opacity-40"
      >
        {syncing ? "Syncing" : "Sync posts"}
      </button>

      {posts.length === 0 ? (
        <p className="mt-3 rounded-sm border border-ink/10 bg-card px-4 py-6 text-[15px] text-muted">
          Nothing synced yet. This reads her posts and flags the ones selling
          quietly, at {threshold} or more purchases per thousand views.
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
