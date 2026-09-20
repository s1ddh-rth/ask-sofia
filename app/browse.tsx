"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

export type Card = {
  id: string;
  name: string;
  category: string;
  price: number;
  quote: string;
  evidence: string;
  takeLabel: string;
  addedAt: string | null;
  image: string | null;
  asked: number;
  seenIn: { title: string; postedAt: string | null } | null;
};

type Sort = "newest" | "asked" | "price";

// Drawn illustrations, not photographs, and not from the case file. A piece
// with no drawing falls back to its initials rather than a broken frame.
function Figure({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return (
      <div className="relative aspect-[4/5] w-full border-b border-ink/10">
        <Image
          src={image}
          alt={name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover"
        />
      </div>
    );
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="flex aspect-[4/5] w-full items-center justify-center border-b border-ink/10 bg-ink/[0.04]">
      <span className="font-heading text-4xl font-bold uppercase text-ink/20">
        {initials}
      </span>
    </div>
  );
}

export default function Browse({
  cards,
  copy,
}: {
  cards: Card[];
  copy: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  // Tapping price again flips it, rather than needing two buttons.
  const [cheapestFirst, setCheapestFirst] = useState(true);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? cards.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.category.toLowerCase().includes(q),
        )
      : cards;

    // Sorted copies, so the incoming order is never mutated.
    return [...filtered].sort((a, b) => {
      if (sort === "price")
        return cheapestFirst ? a.price - b.price : b.price - a.price;
      if (sort === "asked") return b.asked - a.asked || a.name.localeCompare(b.name);
      // Newest by the post it appeared in, falling back to when she added it.
      const at = a.seenIn?.postedAt ?? a.addedAt ?? "";
      const bt = b.seenIn?.postedAt ?? b.addedAt ?? "";
      return bt.localeCompare(at);
    });
  }, [cards, query, sort, cheapestFirst]);

  const sorts: Array<{ key: Sort; label: string }> = [
    { key: "newest", label: copy.sortNewest },
    { key: "asked", label: copy.sortAsked },
    {
      key: "price",
      label:
        sort === "price"
          ? cheapestFirst
            ? copy.sortPriceLow
            : copy.sortPriceHigh
          : copy.sortPrice,
    },
  ];

  return (
    <>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={copy.searchPlaceholder}
        aria-label={copy.searchPlaceholder}
        className="mt-6 w-full rounded-sm border border-ink/15 bg-card px-3 py-3 text-[15px] outline-none placeholder:text-muted/70 focus:border-rust"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {sorts.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => {
              if (s.key === "price" && sort === "price") {
                setCheapestFirst((v) => !v);
              } else {
                setSort(s.key);
                if (s.key === "price") setCheapestFirst(true);
              }
            }}
            aria-pressed={sort === s.key}
            className={`rounded-sm border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] ${
              sort === s.key
                ? "border-rust bg-rust text-card"
                : "border-ink/15 bg-card text-muted"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 rounded-sm border border-ink/10 bg-card px-4 py-6 text-[15px] text-muted">
          {copy.noMatches}
        </p>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((c) => (
            <li key={c.id}>
              <Link
                href={`/s/${c.id}`}
                className="flex h-full flex-col overflow-hidden rounded-sm border border-ink/10 bg-card transition-colors active:bg-ink/5"
              >
                <Figure name={c.name} image={c.image} />
                <div className="flex flex-1 flex-col p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-heading text-lg font-semibold uppercase leading-tight">
                      {c.name}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted">
                      £{c.price}
                    </span>
                  </div>

                  <p className="label mt-2 flex items-baseline gap-1">
                    <span>{copy.takeLabel}</span>
                    {c.evidence ? (
                      <span className="text-[9px] text-muted/70">
                        {c.evidence}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 font-heading text-base font-semibold uppercase leading-tight text-rust">
                    {c.takeLabel}
                  </p>
                  <p className="mt-1 text-[14px] italic leading-snug text-ink/80">
                    &ldquo;{c.quote}&rdquo;
                  </p>

                  {c.seenIn ? (
                    <p className="mt-auto pt-3 font-mono text-[10px] uppercase leading-snug tracking-[0.08em] text-muted">
                      {copy.asSeenIn} {c.seenIn.title}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
