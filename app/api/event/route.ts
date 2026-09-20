import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest } from "@/lib/api";
import { logEvent } from "@/lib/store";

export const dynamic = "force-dynamic";

// Anonymous behaviour only. A browser id the browser made up for itself, what
// happened, and which piece it happened to. Nothing that identifies a person,
// and the schema is the guarantee rather than a promise.
const EventSchema = z.object({
  browserId: z.string().min(8).max(64),
  kind: z.enum([
    "shown",
    "saved",
    "returned",
    "shared",
    "share_opened",
    "checkin",
  ]),
  itemId: z.string().max(80).nullish(),
  groupKey: z.string().max(160).nullish(),
  verdictCall: z.enum(["BUY", "WAIT", "SKIP", "ESCALATE"]).nullish(),
  detail: z
    .enum(["her-link", "somewhere-else", "not-buying", "still-deciding"])
    .nullish(),
  ref: z.string().max(64).nullish(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(badRequest(parsed.error), { status: 400 });
  }

  const e = parsed.data;
  await logEvent({
    browser_id: e.browserId,
    kind: e.kind,
    item_id: e.itemId ?? null,
    group_key: e.groupKey ?? null,
    verdict_call: e.verdictCall ?? null,
    detail: e.detail ?? null,
    ref: e.ref ?? null,
    sample: false,
  });

  return NextResponse.json({ ok: true });
}
