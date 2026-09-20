import Image from "next/image";
import Link from "next/link";
import { loadLive } from "@/lib/store";
import Audience from "./audience";

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

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-40 pt-8">
      <Link href="/" className="label">
        &larr; All pieces
      </Link>

      <h1 className="font-heading mt-3 text-4xl font-bold uppercase leading-[0.95]">
        {item ? item.name : slug.replace(/-/g, " ")}
      </h1>

      {item?.image ? (
        <div className="relative mt-4 aspect-[4/5] w-full overflow-hidden rounded-sm border border-ink/10">
          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 100vw, 28rem"
            className="object-cover"
            priority
          />
        </div>
      ) : null}

      {item ? (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          {[item.category, item.size, `£${item.price}`, STOCK_COPY[item.stock]]
            .filter(Boolean)
            .join(" / ")}
        </p>
      ) : null}

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
    </main>
  );
}
