// Shared state. Supabase when it is configured and reachable, an in-memory
// copy when it is not, so every screen still works with the database down.
// Only ever imported from server routes and server components.

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
    answer: OverrideAnswer;
  }>;
  return Object.fromEntries(rows.map((r) => [r.group_key, r.answer]));
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
