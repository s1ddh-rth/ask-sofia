import Link from "next/link";
import fixture from "@/data/posts.json";
import { ingestPosts } from "@/lib/ingest/posts";
import { takeLabel } from "@/lib/engine/take";
import { listQuestions, loadLive } from "@/lib/store";
import Browse, { type Card } from "./browse";

// Her approved patches have to show here too, not only on the item page, so
// this renders per request rather than being baked at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [data, questions] = await Promise.all([loadLive(), listQuestions()]);
  const { items, copy, rules } = data;
  const ui = copy.ui as Record<string, string>;

  // How many people have asked about each piece, for the most asked sort.
  const asked = new Map<string, number>();
  for (const q of questions) {
    if (!q.item_id) continue;
    asked.set(q.item_id, (asked.get(q.item_id) ?? 0) + 1);
  }

  // Which post each piece appeared in, matched the same way the ingest does
  // so the two never disagree.
  const seenIn = new Map<string, { title: string; postedAt: string | null }>();
  for (const post of ingestPosts(fixture.posts, items, rules)) {
    for (const id of post.item_ids) {
      const existing = seenIn.get(id);
      const postedAt = post.postedAt ?? null;
      if (!existing || (postedAt ?? "") > (existing.postedAt ?? "")) {
        seenIn.set(id, { title: post.title, postedAt });
      }
    }
  }

  const cards: Card[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    price: item.price,
    quote: item.quote,
    evidence: item.evidence[0] ?? "",
    takeLabel: takeLabel(item, copy),
    addedAt: item.addedAt ?? null,
    image: item.image ?? null,
    asked: asked.get(item.id) ?? 0,
    seenIn: seenIn.get(item.id) ?? null,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16 pt-10">
      <p className="label">Case 002 / Operation Lookbook</p>
      <h1 className="font-heading mt-2 text-5xl font-bold uppercase leading-[0.9]">
        Ask Sofia
      </h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
        {ui.tagline}
      </p>

      <Browse cards={cards} copy={ui} />

      {/* Quiet on purpose. A follower reads it and moves on, and anyone
          looking for her side of the product finds it without guessing a
          URL. It is not a call to action competing with the pieces. */}
      <footer className="mt-14 border-t border-ink/10 pt-5">
        <p className="label">{ui.studioPrompt}</p>
        <Link
          href="/studio"
          className="font-heading mt-1 inline-block text-xl font-semibold uppercase text-rust"
        >
          {ui.studioLink} &rarr;
        </Link>
        <p className="mt-1 text-[13px] text-muted">{ui.studioNote}</p>
      </footer>
    </main>
  );
}
