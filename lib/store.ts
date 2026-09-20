// Shared state. Supabase when it is configured and reachable, an in-memory
// copy when it is not, so every screen still works with the database down.
// Only ever imported from server routes and server components.

import { OverrideAnswerSchema } from "@/lib/api";
import { loadData, type LoadedData } from "@/lib/data/load";
import type {
  OverrideAnswer,
  Patch,
  UserContext,
  Verdict,
} from "@/lib/engine/types";

export type QuestionRow = {
  id: string;
  item_id: string | null;
  job: string | null;
  group_key: string | null;
  context: UserContext | null;
  raw_text: string | null;
  source: string | null;
  verdict: Verdict | null;
  rule_fired: string | null;
  latency_ms: number | null;
  escalated: boolean;
  note: string | null;
  feedback: string | null;
  created_at: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseConfigured = Boolean(SUPABASE_URL && SERVICE_KEY);

type Memory = {
  questions: QuestionRow[];
  overrides: Map<string, OverrideAnswer>;
  patches: Patch[];
  shares: Map<string, ShareRow>;
  posts: Map<string, PostRow>;
  events: EventRow[];
};

// The fallback. Lives for as long as the server instance does, which is all
// it promises to do. It hangs off globalThis because Next gives every route
// its own copy of this module. A plain module level object would leave the
// queue, the studio and the audience page each holding a different memory,
// so with the database down nothing she answered would reach anyone.
const globalForMemory = globalThis as typeof globalThis & {
  __askSofiaMemory?: Memory;
};

const memory: Memory = (globalForMemory.__askSofiaMemory ??= {
  questions: [],
  overrides: new Map(),
  patches: [],
  shares: new Map(),
  posts: new Map(),
  events: [],
});

function newId(): string {
  return globalThis.crypto.randomUUID();
}

async function rest(
  path: string,
  init: RequestInit = {},
): Promise<Response | null> {
  if (!supabaseConfigured) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        apikey: SERVICE_KEY as string,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

export async function logQuestion(
  row: Partial<QuestionRow>,
): Promise<QuestionRow> {
  const full: QuestionRow = {
    id: newId(),
    item_id: null,
    job: null,
    group_key: null,
    context: null,
    raw_text: null,
    source: null,
    verdict: null,
    rule_fired: null,
    latency_ms: null,
    escalated: false,
    note: null,
    feedback: null,
    created_at: new Date().toISOString(),
    ...row,
  };

  const res = await rest("questions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      item_id: full.item_id,
      job: full.job,
      group_key: full.group_key,
      context: full.context,
      raw_text: full.raw_text,
      source: full.source,
      verdict: full.verdict,
      rule_fired: full.rule_fired,
      latency_ms: full.latency_ms,
      escalated: full.escalated,
      note: full.note,
      feedback: full.feedback,
    }),
  });

  if (!res) {
    memory.questions.unshift(full);
    return full;
  }
  const [saved] = (await res.json()) as QuestionRow[];
  return saved ?? full;
}

export async function listQuestions(limit = 300): Promise<QuestionRow[]> {
  const res = await rest(
    `questions?select=*&order=created_at.desc&limit=${limit}`,
  );
  if (!res) return memory.questions.slice(0, limit);
  return (await res.json()) as QuestionRow[];
}

export async function getOverrides(): Promise<Record<string, OverrideAnswer>> {
  const res = await rest("overrides?select=group_key,answer");
  if (!res) return Object.fromEntries(memory.overrides);
  const rows = (await res.json()) as Array<{
    group_key: string;
    answer: unknown;
  }>;
  const out: Record<string, OverrideAnswer> = {};
  for (const row of rows) {
    // A row that this app could not have written is dropped rather than
    // rendered. The engine falls back to its own verdict for that group,
    // which is the safe direction to fail in.
    const checked = OverrideAnswerSchema.safeParse(row.answer);
    if (checked.success) out[row.group_key] = checked.data;
  }
  return out;
}

export async function saveOverride(
  groupKey: string,
  answer: OverrideAnswer,
): Promise<void> {
  const res = await rest("overrides", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ group_key: groupKey, answer }),
  });
  if (!res) memory.overrides.set(groupKey, answer);
}

export async function getPatches(): Promise<Patch[]> {
  const res = await rest("patches?select=target,change,reason&order=approved_at.asc");
  if (!res) return [...memory.patches];
  return (await res.json()) as Patch[];
}

export async function savePatch(patch: Patch): Promise<void> {
  const res = await rest("patches", {
    method: "POST",
    body: JSON.stringify(patch),
  });
  if (!res) memory.patches.push(patch);
}

export async function setFeedback(
  questionId: string,
  feedback: string,
): Promise<void> {
  // Encoded, so a crafted id cannot add its own PostgREST parameters.
  const res = await rest(`questions?id=eq.${encodeURIComponent(questionId)}`, {
    method: "PATCH",
    body: JSON.stringify({ feedback }),
  });
  if (!res) {
    const row = memory.questions.find((q) => q.id === questionId);
    if (row) row.feedback = feedback;
  }
}

// sofia.json, then patches, then overrides. The one place that order lives.
export async function loadLive(): Promise<LoadedData> {
  const [patches, overrides] = await Promise.all([
    getPatches(),
    getOverrides(),
  ]);
  return loadData({ patches, overrides });
}

export type ShareRow = {
  ref: string;
  item_id: string | null;
  // The snapshot. Shape is ours, so it carries the group key as well as the
  // verdict, which is what lets a shared link show her answer once she gives
  // one without needing a column for it.
  verdict: {
    verdict: Verdict;
    groupKey: string;
    context?: UserContext;
    asked?: boolean;
  } | null;
  opens: number;
  buy_taps: number;
  created_at: string;
};

// Unambiguous alphabet, no lookalike characters. Sixteen of them is
// roughly 79 bits, which is not worth anyone guessing at.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function newRef(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

export async function createShare(
  row: Omit<ShareRow, "opens" | "buy_taps" | "created_at">,
): Promise<ShareRow> {
  const full: ShareRow = {
    ...row,
    opens: 0,
    buy_taps: 0,
    created_at: new Date().toISOString(),
  };
  const res = await rest("shares", {
    method: "POST",
    body: JSON.stringify({
      ref: full.ref,
      item_id: full.item_id,
      verdict: full.verdict,
    }),
  });
  if (!res) memory.shares.set(full.ref, full);
  return full;
}

export async function getShare(ref: string): Promise<ShareRow | null> {
  const res = await rest(
    `shares?ref=eq.${encodeURIComponent(ref)}&select=*&limit=1`,
  );
  if (!res) return memory.shares.get(ref) ?? null;
  const [row] = (await res.json()) as ShareRow[];
  return row ?? null;
}

// Counting an open or a buy tap must never be able to fail a page render.
export async function countShare(
  ref: string,
  field: "opens" | "buy_taps",
): Promise<void> {
  const current = await getShare(ref);
  if (!current) return;
  const res = await rest(`shares?ref=eq.${encodeURIComponent(ref)}`, {
    method: "PATCH",
    body: JSON.stringify({ [field]: (current[field] ?? 0) + 1 }),
  });
  if (!res) {
    const row = memory.shares.get(ref);
    if (row) row[field] = (row[field] ?? 0) + 1;
  }
}

// Several refs in one round trip, for the list a follower keeps.
export async function getShares(refs: string[]): Promise<ShareRow[]> {
  if (refs.length === 0) return [];
  const inList = refs.map((r) => `"${encodeURIComponent(r)}"`).join(",");
  const res = await rest(`shares?ref=in.(${inList})&select=*`);
  if (!res) {
    return refs
      .map((r) => memory.shares.get(r))
      .filter((r): r is ShareRow => Boolean(r));
  }
  return (await res.json()) as ShareRow[];
}

export async function listShares(): Promise<ShareRow[]> {
  const res = await rest("shares?select=*&order=created_at.desc&limit=200");
  if (!res) return [...memory.shares.values()];
  return (await res.json()) as ShareRow[];
}

export type PostRow = {
  id: string;
  title: string;
  views: number | null;
  saves: number | null;
  purchases: number | null;
  item_ids: string[] | null;
  status: string;
  ingested_at: string;
};

export async function savePosts(rows: Omit<PostRow, "ingested_at">[]) {
  const res = await rest("posts", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(rows),
  });
  if (!res) {
    for (const row of rows) {
      memory.posts.set(row.id, { ...row, ingested_at: new Date().toISOString() });
    }
  }
}

export async function listPosts(): Promise<PostRow[]> {
  const res = await rest("posts?select=*&order=purchases.desc&limit=100");
  if (!res) return [...memory.posts.values()];
  return (await res.json()) as PostRow[];
}

export type EventKind =
  | "shown"
  | "saved"
  | "returned"
  | "shared"
  | "share_opened"
  | "checkin";

export type EventRow = {
  id: string;
  browser_id: string | null;
  kind: EventKind;
  item_id: string | null;
  group_key: string | null;
  verdict_call: string | null;
  detail: string | null;
  ref: string | null;
  sample: boolean;
  created_at: string;
};

// A browser id and nothing else. No name, no email, no address, no fingerprint.
export async function logEvent(row: Partial<EventRow>): Promise<void> {
  const full = {
    browser_id: row.browser_id ?? null,
    kind: row.kind ?? "shown",
    item_id: row.item_id ?? null,
    group_key: row.group_key ?? null,
    verdict_call: row.verdict_call ?? null,
    detail: row.detail ?? null,
    ref: row.ref ?? null,
    sample: row.sample ?? false,
  };
  const res = await rest("events", {
    method: "POST",
    body: JSON.stringify(full),
  });
  if (!res) {
    memory.events.unshift({
      id: newId(),
      created_at: new Date().toISOString(),
      ...full,
    } as EventRow);
  }
}

export async function listEvents(limit = 2000): Promise<EventRow[]> {
  const res = await rest(
    `events?select=*&order=created_at.desc&limit=${limit}`,
  );
  if (!res) return memory.events.slice(0, limit);
  return (await res.json()) as EventRow[];
}
