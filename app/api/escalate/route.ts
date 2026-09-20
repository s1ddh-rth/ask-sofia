import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, ContextSchema, JobSchema, sanitiseText, toContext } from "@/lib/api";
import { groupKey } from "@/lib/data/load";

import { logQuestion } from "@/lib/store";

export const dynamic = "force-dynamic";

const EscalateSchema = z.object({
  itemId: z.string().max(80).nullish(),
  job: JobSchema.default("should-buy"),
  context: ContextSchema.optional(),
  verdict: z.unknown().optional(),
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

  const row = await logQuestion({
    item_id: itemId,
    job: input.job,
    group_key: key,
    context: toContext(input.context ?? { owns: [] }),
    raw_text: input.rawText ? sanitiseText(input.rawText) : null,
    source: "taps",
    verdict: (input.verdict as never) ?? null,
    escalated: true,
    note: input.note ? sanitiseText(input.note) : null,
  });

  return NextResponse.json({ ok: true, groupKey: key, questionId: row.id });
}
