import Link from "next/link";
import { loadData } from "@/lib/data/load";
import Audience from "./audience";

export function generateStaticParams() {
  return loadData().items.map((item) => ({ item: item.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ item: string }>;
}) {
  const { item: slug } = await params;
  const item = loadData().byId[slug];
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
  const { items, byId, rules, copy, ownedTags } = loadData();
  const item = byId[slug] ?? null;

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-40 pt-8">
      <Link href="/" className="label">
        &larr; All pieces
      </Link>

      <h1 className="font-heading mt-3 text-4xl font-bold uppercase leading-[0.95]">
        {item ? item.name : slug.replace(/-/g, " ")}
      </h1>

      {item ? (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
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
      />
    </main>
  );
}
