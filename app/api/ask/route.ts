import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, ContextSchema, JobSchema, sanitiseText, toContext } from "@/lib/api";
import { groupKey } from "@/lib/data/load";
import { decide } from "@/lib/engine/decide";
import { parseQuestion } from "@/lib/parse/groq";
import { loadLive, logQuestion } from "@/lib/store";

export const dynamic = "force-dynamic";

const AskSchema = z.object({
  itemId: z.string().max(80).nullish(),
  rawText: z.string().max(2000).nullish(),
  job: JobSchema.nullish(),
  context: ContextSchema.optional(),
  source: z.enum(["taps", "groq", "fallback"]).default("taps"),
});

export async function POST(req: Request) {
  const started = Date.now();
  const body = await req.json().catch(() => null);
  const parsed = AskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(badRequest(parsed.error), { status: 400 });
  }

  const input = parsed.data;
  const data = await loadLive();
  const context = toContext(input.context ?? { owns: [] });

  let job = input.job ?? "should-buy";
  let itemId = input.itemId ?? null;
  let source = input.source;
  const rawText = input.rawText ? sanitiseText(input.rawText) : null;

  // Free text goes to Groq, which falls back to the keyword matcher on any
  // failure. Either way all it produces is a validated schema.
  if (rawText) {
    const { parsed: read, source: from } = await parseQuestion(
      rawText,
      data.items,
      data.ownedTags,
    );
    job = input.job ?? read.job;
    itemId = input.itemId ?? read.itemId;
    source = from;
    if (read.wear) context.wear = context.wear ?? read.wear;
    if (read.budgetGBP) context.budgetGBP = context.budgetGBP ?? read.budgetGBP;
    if (read.owns.length > 0 && context.owns.length === 0) context.owns = read.owns;
    if (read.occasion !== null) context.occasion = context.occasion ?? read.occasion;
  }

  const key = groupKey(itemId, job);
  const verdict = decide({
    item: itemId ? (data.byId[itemId] ?? null) : null,
    context,
    rules: data.rules,
    copy: data.copy,
    byId: data.byId,
    override: data.overrides[key] ?? null,
  });

  const row = await logQuestion({
    item_id: itemId,
    job,
    group_key: key,
    context,
    raw_text: rawText,
    source,
    verdict,
    rule_fired: verdict.ruleFired,
    latency_ms: Date.now() - started,
  });

  return NextResponse.json({ verdict, groupKey: key, questionId: row.id, job, itemId });
}
