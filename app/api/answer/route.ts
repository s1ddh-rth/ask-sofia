import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, OverrideAnswerSchema } from "@/lib/api";
import { saveOverride } from "@/lib/store";

export const dynamic = "force-dynamic";

// Sofia has already seen this written back to her in structured form. This
// route only runs once she confirms it.
const AnswerSchema = z.object({
  groupKey: z.string().min(1).max(160),
  answer: OverrideAnswerSchema,
  confirmed: z.literal(true),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = AnswerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(badRequest(parsed.error), { status: 400 });
  }

  await saveOverride(parsed.data.groupKey, parsed.data.answer);
  return NextResponse.json({ ok: true, groupKey: parsed.data.groupKey });
}
