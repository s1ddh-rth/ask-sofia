import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, ContextSchema, toContext } from "@/lib/api";
import { groupKey } from "@/lib/data/load";
import { decide } from "@/lib/engine/decide";
import { getOverrides, getShares, loadLive } from "@/lib/store";

export const dynamic = "force-dynamic";

// Everything a follower's own panel needs, in one request.
//
// It only ever accepts things the caller already holds, and returns only
// tokens and calls. Nothing about a person, and nothing they could not have
// worked out by opening each of their own links.
const MineSchema = z.object({
  refs: z.array(z.string().min(1).max(64)).max(30).default([]),
  items: z
    .array(
      z.object({
        itemId: z.string().max(80),
        call: z.string().max(16),
        context: ContextSchema.optional(),
      }),
    )
    .max(30)
    .default([]),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = MineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(badRequest(parsed.error), { status: 400 });
  }

  const { refs, items } = parsed.data;
  const [data, overrides, shares] = await Promise.all([
    loadLive(),
    getOverrides(),
    getShares(refs),
  ]);

  const answered = shares
    .filter((s) => {
      const key = s.verdict?.groupKey;
      return Boolean(key && overrides[key]);
    })
    .map((s) => s.ref);

  // Re-run each saved verdict with the answers they gave at the time, so a
  // change means her judgement moved rather than their inputs.
  const current = items.map((saved) => {
    const context = toContext(saved.context ?? { owns: [] });
    const key = groupKey(saved.itemId, "worth-it");
    const verdict = decide({
      item: data.byId[saved.itemId] ?? null,
      context,
      rules: data.rules,
      copy: data.copy,
      byId: data.byId,
      override: overrides[key] ?? null,
    });
    return {
      itemId: saved.itemId,
      call: verdict.call,
      changed: verdict.call !== saved.call,
    };
  });

  return NextResponse.json({ answered, current });
}
