import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, ContextSchema, JobSchema, toContext } from "@/lib/api";
import { groupKey } from "@/lib/data/load";
import { decide } from "@/lib/engine/decide";
import { countShare, createShare, loadLive, newRef } from "@/lib/store";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  itemId: z.string().max(80).nullish(),
  job: JobSchema.default("worth-it"),
  context: ContextSchema.optional(),
});

const CountSchema = z.object({
  ref: z.string().min(1).max(40),
  event: z.enum(["buy"]),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  // Counting a buy tap on an existing ref.
  const count = CountSchema.safeParse(body);
  if (count.success) {
    await countShare(count.data.ref, "buy_taps");
    return NextResponse.json({ ok: true });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(badRequest(parsed.error), { status: 400 });
  }

  const input = parsed.data;
  const itemId = input.itemId ?? null;
  const context = toContext(input.context ?? { owns: [] });
  const key = groupKey(itemId, input.job);

  // The snapshot is the engine's verdict, taken here, so a shared link cannot
  // be made to say something the engine never said.
  const data = await loadLive();
  const verdict = decide({
    item: itemId ? (data.byId[itemId] ?? null) : null,
    context,
    rules: data.rules,
    copy: data.copy,
    byId: data.byId,
    override: data.overrides[key] ?? null,
    job: input.job,
  });

  const ref = newRef();
  await createShare({
    ref,
    item_id: itemId,
    verdict: { verdict, groupKey: key, context },
  });

  return NextResponse.json({ ref, path: `/v/${ref}` });
}
