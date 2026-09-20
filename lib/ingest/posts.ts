// Post ingest. Today it reads the fixture behind a button in the studio. In
// production the same function would run as a nightly batch over the
// Instagram API and her affiliate platform. It never calls a real external
// API from here.
//
// A post is evidence of what she wore, not of what she thinks, so everything
// this produces is a draft until she confirms it.

import type { Item, Rules } from "@/lib/engine/types";

export type RawPost = {
  id: string;
  title: string;
  views: number;
  saves: number;
  purchases: number;
  item_ids?: string[];
};

export type IngestedPost = RawPost & {
  item_ids: string[];
  matchedBy: "given" | "name" | "none";
  perThousand: number;
  quietWinner: boolean;
  status: "draft";
};

// Words too common to identify a piece on their own.
const STOP = new Set([
  "the",
  "and",
  "with",
  "from",
  "that",
  "this",
  "outfit",
  "outfits",
  "wore",
  "wear",
  "wearing",
  "would",
  "never",
  "again",
  "everything",
  "challenge",
  "keep",
  "things",
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
    .filter((item) =>
      wordsOf(item.name).some((w) => words.has(w)),
    )
    .map((item) => item.id);
}

export function ingestPosts(
  posts: RawPost[],
  items: Item[],
  rules: Rules,
): IngestedPost[] {
  return posts.map((post) => {
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
    };
  });
}
