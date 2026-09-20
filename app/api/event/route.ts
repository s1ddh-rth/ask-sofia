import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest } from "@/lib/api";
import { loadLive, logEvent } from "@/lib/store";

export const dynamic = "force-dynamic";

// Anonymous behaviour only. A browser id the browser made up for itself, what
// happened, and which piece it happened to. Nothing that identifies a person,
// and the schema is the guarantee rather than a promise.
const EventSchema = z.object({
  // A uuid the browser made for itself, or the short fallback a private
  // window gets. Anything else is somebody making rows up.
  browserId: z.string().regex(/^[w-]{8,64}$/),
  kind: z.enum([
    "shown",
    "saved",
    "returned",
    "shared",
    "share_opened",
    "checkin",
  ]),
  itemId: z.string().regex(/^[a-z0-9-]{1,80}$/).nullish(),
  groupKey: z.string().regex(/^[a-z0-9-]{1,80}:[a-z-]{1,24}$/).nullish(),
  verdictCall: z.enum(["BUY", "WAIT", "SKIP", "ESCALATE"]).nullish(),
  detail: z
    .enum(["her-link", "somewhere-else", "not-buying", "still-deciding"])
    .nullish(),
  ref: z.string().regex(/^[a-z0-9]{1,64}$/).nullish(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(badRequest(parsed.error), { status: 400 });
  }

  const e = parsed.data;

  // An event about a piece has to be about a piece that exists. This panel
  // is the product's headline claim, so the numbers cannot be invented from
  // outside.
  if (e.itemId) {
    const { byId } = await loadLive();
    if (!byId[e.itemId]) {
      return NextResponse.json(
        { error: "Unknown item", field: "itemId" },
        { status: 400 },
      );
    }
  }

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
