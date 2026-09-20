import { NextResponse } from "next/server";
import { z } from "zod";
import fixture from "@/data/posts.json";
import { badRequest } from "@/lib/api";
import { ingest } from "@/lib/ingest/posts";
import { loadLive, savePosts } from "@/lib/store";

export const dynamic = "force-dynamic";

const IngestSchema = z.object({
  mode: z.enum(["backfill", "nightly"]).default("nightly"),
  months: z.number().int().min(1).max(24).optional(),
  since: z.string().max(40).nullish(),
});

// Runs the ingest over the fixture. In production the same function would run
// once on connect for the backfill and nightly after that, over the Instagram
// API and her affiliate platform. Everything it writes is a draft.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = IngestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(badRequest(parsed.error), { status: 400 });
  }

  const { items, rules } = await loadLive();
  const input = parsed.data;

  const result =
    input.mode === "backfill"
      ? ingest(fixture.posts, items, rules, {
          mode: "backfill",
          months: input.months ?? 12,
        })
      : ingest(fixture.posts, items, rules, {
          mode: "nightly",
          since: input.since ?? null,
        });

  await savePosts(
    result.posts.map((p) => ({
      id: p.id,
      title: p.title,
      views: p.views,
      saves: p.saves,
      purchases: p.purchases,
      item_ids: p.item_ids,
      status: "draft",
    })),
  );

  return NextResponse.json({
    ok: true,
    mode: result.mode,
    window: result.window,
    count: result.posts.length,
    quietWinners: result.quietWinners,
    refreshed: result.refreshed,
    ranAt: result.ranAt,
  });
}
