import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, ContextSchema, toContext } from "@/lib/api";
import { groupKey } from "@/lib/data/load";
import { decide } from "@/lib/engine/decide";
import { getOverrides, loadLive } from "@/lib/store";

export const dynamic = "force-dynamic";

// The decide job, run across a shortlist.
//
// It does not invent a comparison. It runs the same engine over each piece
// and orders them by what it already said, buys first, then by cost per wear,
// so the ordering is her rules applied several times rather than a new
// opinion about which is best.
const ChooseSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().max(80),
        context: ContextSchema.optional(),
      }),
    )
    .min(2)
    .max(30),
});

const ORDER: Record<string, number> = { BUY: 0, WAIT: 1, ESCALATE: 2, SKIP: 3 };

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = ChooseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(badRequest(parsed.error), { status: 400 });
  }

  const [data, overrides] = await Promise.all([loadLive(), getOverrides()]);

  const ranked = parsed.data.items
    .map((entry) => {
      const context = toContext(entry.context ?? { owns: [] });
      const key = groupKey(entry.itemId, "decide");
      const verdict = decide({
        item: data.byId[entry.itemId] ?? null,
        context,
        rules: data.rules,
        copy: data.copy,
        byId: data.byId,
        override: overrides[key] ?? null,
      });
      return {
        itemId: entry.itemId,
        call: verdict.call,
        costPerWear: verdict.costPerWear ?? null,
        reasons: verdict.reasons,
      };
    })
    .sort(
      (a, b) =>
        (ORDER[a.call] ?? 9) - (ORDER[b.call] ?? 9) ||
        (a.costPerWear ?? Infinity) - (b.costPerWear ?? Infinity),
    );

  return NextResponse.json({ ranked });
}
