// The contract the whole app agrees on. Nothing here does any work.

export type VerdictType =
  | "investment"
  | "basic"
  | "statement"
  | "situational"
  | "avoid";

export type Job =
  | "where"
  | "decide"
  | "cheaper"
  | "size"
  | "pairing"
  | "adapt"
  | "worth-it" // is this particular piece worth it for me
  | "should-buy" // should I be buying anything at all
  | "other";

export type Stock = "in" | "low" | "one-off" | "out";
export type Wear = "weekly" | "few" | "occasional";
export type Call = "BUY" | "WAIT" | "SKIP" | "ESCALATE";

// What the loader hands out. Everything past the five required fields is
// optional in the raw data, so the loader fills a default and downstream
// code never has to guess.
export type Item = {
  id: string;
  name: string;
  category: string;
  price: number; // GBP
  size: string;
  style: string;
  stock: Stock;
  verdictType: VerdictType;
  quote: string; // her exact words
  buyAgain: boolean | null; // null when the evidence doesn't say
  caveat?: { text: string; severity: "soft" | "hard" };
  pairsWith: string[]; // item ids or owned-basic tags
  cheaperOk?: { maxPrice: number; note: string };
  seasonNote?: string;
  fitNote?: string;
  paid: boolean;
  link?: string;
  evidence: string[]; // sheet refs, e.g. "E-04.1"
  addedAt?: string; // when she added it, for sorting the browse page
  [key: string]: unknown; // unknown fields pass through untouched
};

export type Rules = {
  cpwMonths: number; // demo assumption
  cpwMaxGBP: number; // demo assumption
  basicCapGBP: number; // from "£35 is enough"
  maxPairings: number; // from "3 things I truly love"
  wearsPerMonth: { weekly: number; few: number; occasional: number };
  quietWinnerPer1000Views: number; // from E-03.4, used by the post ingest
  suggestAfterRepeats: number; // how many repeats before a rule is proposed
  reviewAfterThumbsDown: number; // how many thumbs down before a review
};

export type UserContext = {
  wear?: Wear;
  budgetGBP?: number;
  owns: string[];
  occasion?: boolean;
};

export type Verdict = {
  call: Call;
  ruleFired: string; // shown in the studio as the "why" line
  reasons: string[]; // built from her quotes and templates, never from the LLM
  costPerWear?: number;
  pairings: string[];
  alternative?: string;
  caveat?: string;
  paidDisclosure?: boolean;
  confident: boolean;
};

export type ParsedQuestion = {
  job: Job;
  itemId: string | null;
  budgetGBP: number | null;
  wear: Wear | null;
  owns: string[];
  occasion: boolean | null;
};

export type Patch = {
  target: string; // item id, a new item id, or "rules"
  change: Record<string, unknown>;
  reason: string; // the suggestion or edit it came from
};

// Sofia's confirmed answer to a grouped question. Stored against a group_key
// and returned verbatim, which is why it is not a full Verdict.
export type OverrideAnswer = {
  call: Call;
  reasons: string[];
  alternative?: string;
  caveat?: string;
};

// Every string the UI says lives in the data, so tone is a data edit.
export type Copy = {
  takeLabels: Record<VerdictType, string>;
  callLabels: Record<Call, string>;
  reasons: Record<string, string>;
  ui: Record<string, string | Record<string, string>>;
};

export type SofiaData = {
  rules: Rules;
  ownedTags: string[];
  items: Item[];
  copy: Copy;
};
