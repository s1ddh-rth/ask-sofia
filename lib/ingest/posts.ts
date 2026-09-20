// Post ingest, in the two shapes it would really run in.
//
// Backfill takes a date window, twelve months by default, and is what runs
// once when Sofia first connects her account. Nightly takes anything since
// the last run plus a refresh of the last two days, because Instagram
// insights can lag by up to 48 hours and a number read last night may not be
// the number today.
//
// Today both read data/posts.json. Neither calls a real external API from
// here, and both produce drafts, because a post is evidence of what she wore
// and not of what she thinks.

import type { Item, Rules } from "@/lib/engine/types";

export type RawPost = {
  id: string;
  title: string;
  views: number;
  saves: number;
  purchases: number;
  item_ids?: string[];
  // Sample values. The case pack gives no dates or audio.
  postedAt?: string;
  audio?: string;
  audioTitle?: string;
};

export type IngestedPost = RawPost & {
  item_ids: string[];
  matchedBy: "given" | "name" | "none";
  perThousand: number;
  quietWinner: boolean;
  status: "draft";
  // Why this post is in the run, which is the difference between the modes.
  reason: "in-window" | "new-since-last-run" | "refreshed";
};

export type IngestMode =
  | { mode: "backfill"; months?: number; now?: string }
  | { mode: "nightly"; since?: string | null; now?: string };

export type IngestResult = {
  mode: "backfill" | "nightly";
  window: { from: string; to: string };
  posts: IngestedPost[];
  quietWinners: string[];
  refreshed: string[];
  // What the next nightly run would use as its starting point.
  ranAt: string;
};

const DAY = 24 * 60 * 60 * 1000;
const LAG_DAYS = 2;

// Words too common to identify a piece on their own.
const STOP = new Set([
  "the", "and", "with", "from", "that", "this",
  "outfit", "outfits", "wore", "wear", "wearing",
  "would", "never", "again", "everything", "challenge", "keep", "things",
]);

function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

// Matches a post to a piece by name, never by category, so "the shoes" does
// not become the loafers just because the loafers are shoes.
function matchByName(title: string, items: Item[]): string[] {
  const words = new Set(wordsOf(title));
  return items
    .filter((item) => wordsOf(item.name).some((w) => words.has(w)))
    .map((item) => item.id);
}

function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function score(
  post: RawPost,
  items: Item[],
  rules: Rules,
  reason: IngestedPost["reason"],
): IngestedPost {
  const given = post.item_ids ?? [];
  const matched = given.length > 0 ? given : matchByName(post.title, items);
  // Purchases per thousand views. A post can be quiet and still sell, which
  // is the thing worth surfacing, as in E-03.4.
  const perThousand =
    post.views > 0
      ? Math.round((post.purchases / post.views) * 1000 * 100) / 100
      : 0;

  return {
    ...post,
    item_ids: matched,
    matchedBy: given.length > 0 ? "given" : matched.length > 0 ? "name" : "none",
    perThousand,
    quietWinner: perThousand >= rules.quietWinnerPer1000Views,
    status: "draft",
    reason,
  };
}

export function ingest(
  posts: RawPost[],
  items: Item[],
  rules: Rules,
  options: IngestMode,
): IngestResult {
  const nowMs = options.now ? Date.parse(options.now) : Date.now();
  const ranAt = new Date(nowMs).toISOString();

  if (options.mode === "backfill") {
    const months = options.months ?? 12;
    const from = new Date(nowMs);
    from.setMonth(from.getMonth() - months);
    const fromMs = from.getTime();

    const selected = posts.filter((p) => {
      if (!p.postedAt) return true; // undated posts are never silently dropped
      const at = Date.parse(p.postedAt);
      return at >= fromMs && at <= nowMs;
    });

    const scored = selected.map((p) => score(p, items, rules, "in-window"));
    return {
      mode: "backfill",
      window: { from: iso(fromMs), to: iso(nowMs) },
      posts: scored,
      quietWinners: scored.filter((p) => p.quietWinner).map((p) => p.id),
      refreshed: [],
      ranAt,
    };
  }

  // Nightly. Anything new since the last run, plus a refresh of the last two
  // days, because the numbers move after the fact.
  const sinceMs = options.since ? Date.parse(options.since) : 0;
  const refreshFromMs = nowMs - LAG_DAYS * DAY;

  const scored: IngestedPost[] = [];
  for (const post of posts) {
    const at = post.postedAt ? Date.parse(post.postedAt) : 0;
    if (at > sinceMs) {
      scored.push(score(post, items, rules, "new-since-last-run"));
    } else if (at >= refreshFromMs) {
      scored.push(score(post, items, rules, "refreshed"));
    }
  }

  return {
    mode: "nightly",
    window: { from: iso(sinceMs || refreshFromMs), to: iso(nowMs) },
    posts: scored,
    quietWinners: scored.filter((p) => p.quietWinner).map((p) => p.id),
    refreshed: scored.filter((p) => p.reason === "refreshed").map((p) => p.id),
    ranAt,
  };
}

// Kept so the earlier call sites and tests keep working. A plain scoring
// pass over everything, with no window.
export function ingestPosts(
  posts: RawPost[],
  items: Item[],
  rules: Rules,
): IngestedPost[] {
  return posts.map((p) => score(p, items, rules, "in-window"));
}
