import Link from "next/link";
import { loadData } from "@/lib/data/load";

export default function Home() {
  const { items, copy } = loadData();

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
      <p className="label">Case 002 / Operation Lookbook</p>
      <h1 className="font-heading mt-2 text-5xl font-bold uppercase leading-[0.9]">
        Ask Sofia
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        Her actual opinion on whether a piece is worth it for you, not a link.
        Pick something she has written about.
      </p>

      <ul className="mt-8 space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/s/${item.id}`}
              className="block rounded-sm border border-ink/10 bg-card px-4 py-4 transition-colors active:bg-ink/5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-heading text-2xl font-semibold uppercase leading-tight">
                  {item.name}
                </span>
                <span className="font-mono text-sm text-muted">
                  £{item.price}
                </span>
              </div>
              <p className="label mt-1">
                {copy.takeLabels[item.verdictType]}
              </p>
              <p className="mt-2 text-[15px] italic text-ink/80">
                &ldquo;{item.quote}&rdquo;
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
