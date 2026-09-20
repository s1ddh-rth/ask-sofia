import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, ContextSchema, JobSchema, sanitiseText, toContext } from "@/lib/api";
import { groupKey } from "@/lib/data/load";
import { decide } from "@/lib/engine/decide";
import { createShare, loadLive, logQuestion, newRef } from "@/lib/store";

export const dynamic = "force-dynamic";

const EscalateSchema = z.object({
  itemId: z.string().max(80).nullish(),
  job: JobSchema.default("worth-it"),
  context: ContextSchema.optional(),
  note: z.string().max(2000).nullish(),
  rawText: z.string().max(2000).nullish(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = EscalateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(badRequest(parsed.error), { status: 400 });
  }

  const input = parsed.data;
  const itemId = input.itemId ?? null;
  const key = groupKey(itemId, input.job);
  const context = toContext(input.context ?? { owns: [] });

  // The verdict is re-derived here rather than taken from the request. Sofia
  // answers from what she reads in the queue, so it has to be the engine's
  // verdict and not one a caller could make up. decide is deterministic, so
  // this is the same answer they saw.
  const data = await loadLive();
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
    job: input.job,
    group_key: key,
    context,
    raw_text: input.rawText ? sanitiseText(input.rawText) : null,
    source: "taps",
    verdict,
    rule_fired: verdict.ruleFired,
    escalated: true,
    note: input.note ? sanitiseText(input.note) : null,
  });

  // Nothing is collected about the person, so there is no way to write back
  // to them. Instead they get a link to return to. It shows the verdict they
  // had, and her answer once she has given one.
  const ref = newRef();
  await createShare({
    ref,
    item_id: itemId,
    verdict: { verdict, groupKey: key, context, asked: true },
  });

  return NextResponse.json({
    ok: true,
    groupKey: key,
    questionId: row.id,
    ref,
    path: `/v/${ref}`,
  });
}
