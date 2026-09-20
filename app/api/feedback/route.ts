import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest } from "@/lib/api";
import { setFeedback } from "@/lib/store";

export const dynamic = "force-dynamic";

const FeedbackSchema = z.object({
  questionId: z.string().min(1).max(80),
  feedback: z.enum(["down"]),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = FeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(badRequest(parsed.error), { status: 400 });
  }
  await setFeedback(parsed.data.questionId, parsed.data.feedback);
  return NextResponse.json({ ok: true });
}
