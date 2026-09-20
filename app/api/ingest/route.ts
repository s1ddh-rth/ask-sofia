import { NextResponse } from "next/server";
import fixture from "@/data/posts.json";
import { ingestPosts } from "@/lib/ingest/posts";
import { loadLive, savePosts } from "@/lib/store";

export const dynamic = "force-dynamic";

// Runs the ingest over the fixture. In production this same function would
// run nightly over the Instagram API and her affiliate platform. Everything
// it writes is a draft, because a post shows what she wore, not her verdict.
export async function POST() {
  const { items, rules } = await loadLive();
  const ingested = ingestPosts(fixture.posts, items, rules);

  await savePosts(
    ingested.map((p) => ({
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
    count: ingested.length,
    quietWinners: ingested.filter((p) => p.quietWinner).map((p) => p.id),
  });
}
