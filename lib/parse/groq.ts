// Free text to a validated ParsedQuestion. This is the only thing a language
// model does in this app. It never sees a verdict, never writes one, and
// never changes one. Anything it gets wrong falls through to the keyword
// matcher, which is deterministic.

import { z } from "zod";
import type { Item, ParsedQuestion } from "@/lib/engine/types";
import { parseFallback } from "./fallback";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 4000;

export type ParseResult = {
  parsed: ParsedQuestion;
  source: "groq" | "fallback";
  latencyMs: number;
};

// Output guardrail. The model is told to return exactly this and anything
// else is thrown away rather than repaired.
const ModelSchema = z.object({
  job: z.enum([
    "where",
    "decide",
    "cheaper",
    "size",
    "pairing",
    "adapt",
    "should-buy",
    "other",
  ]),
  itemId: z.string().nullable(),
  budgetGBP: z.number().positive().max(100000).nullable(),
  wear: z.enum(["weekly", "few", "occasional"]).nullable(),
  owns: z.array(z.string()).max(20),
  occasion: z.boolean().nullable(),
});

// Input guardrail. Caps the length, drops anything that looks like a way to
// contact someone, and flattens whitespace.
export function guardInput(raw: string): string {
  return raw
    .slice(0, 500)
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "")
    .replace(/(\+?\d[\d\s()-]{7,}\d)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Cheap reasons not to spend a model call. Deliberately narrow, because the
// keyword matcher already handles messages that are merely unanswerable.
const SPAM = [
  /\bfollow\s*back\b/i,
  /\bcrypto\b/i,
  /\bgiveaway\s*winner\b/i,
  /https?:\/\//i,
  /\bclick here\b/i,
];

export function isOffTopic(text: string): boolean {
  if (text.length < 3) return true;
  if (!/[a-z]/i.test(text)) return true;
  return SPAM.some((p) => p.test(text));
}

function systemPrompt(items: Item[], ownedTags: string[]): string {
  const ids = items.map((i) => `${i.id} (${i.name})`).join(", ");
  return [
    "You read one message from a follower of a fashion creator and turn it into JSON.",
    "You do not answer the question. You do not give opinions, advice or verdicts.",
    "",
    "Return exactly this shape and nothing else:",
    '{"job":string,"itemId":string|null,"budgetGBP":number|null,"wear":string|null,"owns":string[],"occasion":boolean|null}',
    "",
    "job is one of: where (asking where to buy), decide (asking her to choose or they cannot decide), cheaper (asking for a cheaper version or naming a budget), size (asking about sizing or fit), pairing (asking what to wear it with), adapt (asking to restyle it for their life or an event), should-buy (asking whether to buy at all, or asking to use what they own), other (anything else, including compliments and messages with no question).",
    "",
    `itemId must be one of these ids or null: ${ids}`,
    "Only set itemId when the message clearly names that piece. A category word like shoes or coat is not enough, use null.",
    "",
    "budgetGBP is the amount they are willing to spend, not a price they are complaining about. null if absent.",
    "wear is weekly, few or occasional, describing how often they would wear it. null if absent.",
    `owns is any of these they say they already own: ${ownedTags.join(", ")}. Empty array if none.`,
    "occasion is true only if they mention a specific event such as a wedding or a date. null otherwise.",
  ].join("\n");
}

async function callGroq(
  text: string,
  items: Item[],
  ownedTags: string[],
): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL;
  if (!apiKey || !model) throw new Error("Groq is not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_completion_tokens: 512,
        response_format: { type: "json_object" },
        // gpt-oss reasons before answering. For a six field extraction that
        // is pure latency, so keep it at the floor.
        ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
        messages: [
          { role: "system", content: systemPrompt(items, ownedTags) },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Groq returned ${res.status}`);
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("Groq returned no content");
    return JSON.parse(content);
  } finally {
    clearTimeout(timer);
  }
}

export async function parseQuestion(
  raw: string,
  items: Item[],
  ownedTags: string[],
): Promise<ParseResult> {
  const started = Date.now();
  const text = guardInput(raw);

  const fall = (): ParseResult => ({
    parsed: parseFallback(text, items, ownedTags),
    source: "fallback",
    latencyMs: Date.now() - started,
  });

  if (isOffTopic(text)) return fall();

  try {
    const raw = await callGroq(text, items, ownedTags);
    const checked = ModelSchema.safeParse(raw);
    if (!checked.success) return fall();

    const out = checked.data;
    // The model does not get to invent an item or an owned tag.
    const itemId =
      out.itemId && items.some((i) => i.id === out.itemId) ? out.itemId : null;
    const allowed = new Set(ownedTags);
    const owns = out.owns.filter((o) => allowed.has(o));

    return {
      parsed: { ...out, itemId, owns },
      source: "groq",
      latencyMs: Date.now() - started,
    };
  } catch {
    return fall();
  }
}
