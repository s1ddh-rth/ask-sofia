import Image from "next/image";
import Link from "next/link";
import fixture from "@/data/posts.json";
import { ingestPosts } from "@/lib/ingest/posts";
import { takeLabel } from "@/lib/engine/take";
import { loadLive } from "@/lib/store";
import Audience from "./audience";
import CheckIn from "./checkin";

// Overrides and patches have to be live, so this renders per request.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ item: string }>;
}) {
  const { item: slug } = await params;
  const item = (await loadLive()).byId[slug];
  return {
    title: item ? `${item.name} — Ask Sofia` : "Ask Sofia",
    description: item
      ? `Sofia on the ${item.name.toLowerCase()}. "${item.quote}"`
      : "Her actual opinion on whether a piece is worth it for you.",
  };
}

const STOCK_COPY: Record<string, string> = {
  in: "In stock",
  low: "Low stock",
  "one-off": "One off",
  out: "Out of stock",
};

export default async function ItemPage({
  params,
}: {
  params: Promise<{ item: string }>;
}) {
  const { item: slug } = await params;
  const { items, byId, rules, copy, ownedTags, overrides } = await loadLive();
  const item = byId[slug] ?? null;
  const ui = copy.ui as Record<string, string>;

  // Her confirmed answers for this piece, whichever question they came from.
  // Her words only, never anything about the person who asked.
  const herAnswers = item
    ? Object.entries(overrides)
        .filter(([key]) => key.startsWith(`${item.id}:`))
        .map(([, answer]) => answer)
    : [];

  // The post this piece appeared in, matched the same way the ingest does.
  const seenIn = item
    ? (ingestPosts(fixture.posts, items, rules).find((p) =>
        p.item_ids.includes(item.id),
      ) ?? null)
    : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-40 pt-8">
      <Link href="/" className="label">
        &larr; All pieces
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Her side of it. On a laptop this stays put while you work. */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <h1 className="font-heading text-4xl font-bold uppercase leading-[0.95]">
            {item ? item.name : slug.replace(/-/g, " ")}
          </h1>

          {item ? (
            <p className="mb-4 mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              {[item.category, item.size, STOCK_COPY[item.stock]]
                .filter(Boolean)
                .join(" / ")}
            </p>
          ) : null}

          {item?.image ? (
            <div className="relative aspect-[5/4] w-full overflow-hidden rounded-sm border border-ink/10 bg-paper sm:aspect-[4/3] lg:aspect-[4/5]">
              <Image
                src={item.image}
                alt={item.name}
                fill
                sizes="(max-width: 1024px) 100vw, 32rem"
                className="object-contain p-2"
                priority
              />
              <span className="stamp absolute right-3 top-3 bg-paper/80 px-2 py-1 text-sm backdrop-blur">
                {takeLabel(item, copy)}
              </span>
              <span className="absolute bottom-3 left-3 rounded-sm bg-ink px-2 py-1 font-mono text-[11px] tracking-[0.08em] text-card">
                £{item.price}
              </span>
            </div>
          ) : null}

          {item ? (
            <blockquote className="mt-5 border-l-2 border-rust pl-4">
              <p className="label flex items-baseline gap-2">
                <span>{ui.takeLabel}</span>
                {item.evidence[0] ? (
                  <span className="text-[9px] text-muted/70">
                    {item.evidence[0]}
                  </span>
                ) : null}
              </p>
              <p className="mt-2 font-heading text-3xl font-semibold leading-tight">
                &ldquo;{item.quote}&rdquo;
              </p>
            </blockquote>
          ) : null}

          {herAnswers.length > 0 ? (
            <section className="mt-5 rounded-sm border border-rust/40 bg-rust/5 p-4">
              <p className="label">Sofia answered this</p>
              {herAnswers.map((answer, i) => (
                <div key={i} className={i === 0 ? "mt-1" : "mt-3"}>
                  <p className="font-heading text-xl font-semibold uppercase text-rust">
                    {copy.callLabels[answer.call]}
                  </p>
                  {answer.reasons.map((reason, j) => (
                    <p key={j} className="mt-1 text-[15px] leading-relaxed">
                      {reason}
                    </p>
                  ))}
                </div>
              ))}
            </section>
          ) : null}

          {seenIn ? (
            <p className="mt-4 font-mono text-[10px] uppercase leading-snug tracking-[0.08em] text-muted">
              {ui.asSeenIn} {seenIn.title}
            </p>
          ) : null}
        </div>

        {/* Your side of it. */}
        <div>
          {item ? <CheckIn itemId={item.id} itemName={item.name} /> : null}

          <Audience
            item={item}
            itemSlug={slug}
            items={items}
            byId={byId}
            rules={rules}
            copy={copy}
            ownedTags={ownedTags}
            overrides={overrides}
          />
        </div>
      </div>
    </main>
  );
}
