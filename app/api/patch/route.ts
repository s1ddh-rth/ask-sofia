import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest } from "@/lib/api";
import { loadData } from "@/lib/data/load";
import { getPatches, savePatch } from "@/lib/store";

export const dynamic = "force-dynamic";

// A patch is only ever written after Sofia has seen it and confirmed it,
// whether it came from a suggestion or from her editing an item directly.
const PatchSchema = z.object({
  target: z.string().min(1).max(80),
  change: z.record(z.string(), z.unknown()),
  reason: z.string().min(1).max(400),
  confirmed: z.literal(true),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(badRequest(parsed.error), { status: 400 });
  }

  const { target, change, reason } = parsed.data;
  const candidate = { target, change, reason };

  // Dry run it against everything already live. A patch that would not
  // validate is refused here with the field named, and nothing is written,
  // so the previous state stays live.
  const existing = await getPatches();
  const { patchErrors } = loadData({ patches: [...existing, candidate] });
  const rejected = patchErrors.find((e) => e.target === target);
  if (rejected) {
    return NextResponse.json(
      {
        error: "Patch rejected",
        target: rejected.target,
        field: rejected.field,
        detail: rejected.message,
      },
      { status: 422 },
    );
  }

  await savePatch(candidate);
  return NextResponse.json({ ok: true, target, change });
}
