// Keyword matcher. Used when Groq fails, is unavailable, or is not worth
// calling. Pure, no network, so every screen still works without a backend.

import type { Item, Job, ParsedQuestion, Wear } from "@/lib/engine/types";

// Ordered. The first job whose pattern matches wins, so the specific
// phrasings sit above the loose ones.
const JOB_PATTERNS: Array<{ job: Job; patterns: RegExp[] }> = [
  {
    job: "size",
    patterns: [/\bwhat size\b/, /\bsize (are|do|is)\b/, /\btrue to size\b/, /\bsizing\b/, /\bruns (small|big|large)\b/],
  },
  {
    job: "where",
    patterns: [/\bwhere (is|are|did|can|do)\b/, /\bwhere'?s\b/, /\blink\b/, /\bwho makes\b/, /\bstockist\b/],
  },
  {
    job: "cheaper",
    patterns: [/\bcheaper\b/, /\bdupe\b/, /\bunder £?\d/, /\bless than\b/, /\baffordable\b/, /\bbudget version\b/, /\bon a budget\b/],
  },
  {
    job: "adapt",
    patterns: [/\bhow would you (change|style|wear)\b/, /\bversion of (this|it) for\b/, /\bmake (this|it) work\b/, /\bsame energy\b/, /\bless corporate\b/, /\bdress (it )?(up|down)\b/],
  },
  {
    job: "pairing",
    patterns: [/\b(wear|go|goes|pair) (it )?with\b/, /\bwhat (should|do) i wear with\b/, /\bstyle (it|them)\b/, /\bpairs? with\b/],
  },
  {
    job: "should-buy",
    patterns: [/\bshould i (buy|get)\b/, /\bworth it\b/, /\bworth the money\b/, /\btrying not to buy\b/, /\bstop buying\b/, /\buse what i (own|have)\b/, /\bdo i need\b/],
  },
  {
    job: "decide",
    patterns: [/\bif you were me\b/, /\bwhich one\b/, /\bstill deciding\b/, /\bhelp me decide\b/, /\bcan'?t decide\b/, /\bactually buy\b/],
  },
];

const WEAR_PATTERNS: Array<{ wear: Wear; patterns: RegExp[] }> = [
  { wear: "weekly", patterns: [/\bevery week\b/, /\bweekly\b/, /\ball the time\b/, /\bevery day\b/, /\bdaily\b/, /\bconstantly\b/] },
  { wear: "few", patterns: [/\bfew times\b/, /\bcouple of times\b/, /\btwice a month\b/, /\bfortnightly\b/] },
  { wear: "occasional", patterns: [/\bnow and then\b/, /\boccasionally\b/, /\bonce in a while\b/, /\brarely\b/, /\bhardly ever\b/, /\bonce a year\b/] },
];

const OCCASION_PATTERNS = [
  /\bwedding\b/, /\bparty\b/, /\bdate night\b/, /\ba date\b/, /\bdinner\b/,
  /\bevent\b/, /\bchristmas\b/, /\bholiday\b/, /\boccasion\b/, /\bnight out\b/,
  /\bbirthday\b/, /\bgraduation\b/,
];

// "under £120" beats a price she is complaining about, like "£400".
function findBudget(text: string): number | null {
  const anchored = text.match(/\b(?:under|below|less than|max|up to)\s*£?\s*(\d{1,5})/);
  if (anchored) return Number(anchored[1]);
  const pounds = text.match(/£\s*(\d{1,5})/);
  return pounds ? Number(pounds[1]) : null;
}

// Item names only, never categories. "the shoes" should not resolve to the
// loafers just because they happen to be shoes.
function findItemId(text: string, items: Item[]): string | null {
  let best: { id: string; score: number } | null = null;
  for (const item of items) {
    const words = item.name
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 3);
    const hits = words.filter((w) => text.includes(w)).length;
    if (hits > 0 && (!best || hits > best.score)) {
      best = { id: item.id, score: hits };
    }
  }
  return best ? best.id : null;
}

function findOwns(text: string, ownedTags: string[]): string[] {
  return ownedTags.filter((tag) => text.includes(tag.replace(/-/g, " ")) || text.includes(tag));
}

function firstMatch<T>(
  text: string,
  table: Array<{ patterns: RegExp[] } & Record<string, unknown>>,
  key: string,
): T | null {
  for (const row of table) {
    if (row.patterns.some((p) => p.test(text))) return row[key] as T;
  }
  return null;
}

export function parseFallback(
  raw: string,
  items: Item[],
  ownedTags: string[],
): ParsedQuestion {
  const text = raw.toLowerCase();
  return {
    job: firstMatch<Job>(text, JOB_PATTERNS, "job") ?? "other",
    itemId: findItemId(text, items),
    budgetGBP: findBudget(text),
    wear: firstMatch<Wear>(text, WEAR_PATTERNS, "wear"),
    owns: findOwns(text, ownedTags),
    occasion: OCCASION_PATTERNS.some((p) => p.test(text)) ? true : null,
  };
}
