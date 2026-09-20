import Link from "next/link";
import { countShare, getShare, loadLive } from "@/lib/store";
import BuyTap from "./buy";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const share = await getShare(ref);
  const item = share?.item_id
    ? (await loadLive()).byId[share.item_id]
    : undefined;
  return {
    // Somebody's own link. Never in a search result.
    robots: { index: false, follow: false },
    title: item ? `${item.name} — Ask Sofia` : "A verdict — Ask Sofia",
    description: item
      ? `Sofia on the ${item.name.toLowerCase()}. "${item.quote}"`
      : "Sofia's verdict on a piece.",
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const share = await getShare(ref);

  if (!share || !share.verdict) {
    return (
      <main className="mx-auto w-full max-w-md px-5 pb-20 pt-10">
        <p className="label">Case 002 / Operation Lookbook</p>
        <h1 className="font-heading mt-2 text-4xl font-bold uppercase leading-[0.95]">
          Nothing here
        </h1>
        <p className="mt-3 text-[15px] text-muted">
          That link has expired or was never a verdict.
        </p>
        <Link href="/" className="label mt-6 inline-block">
          See what she has talked about &rarr;
        </Link>
      </main>
    );
  }

  // A share link exists to be opened, so counting one is the point.
  await countShare(ref, "opens");

  const data = await loadLive();
  const snapshot = share.verdict.verdict;
  const item = share.item_id ? (data.byId[share.item_id] ?? null) : null;
  // If Sofia has answered this group since the link was made, say so. The
  // snapshot stays exactly as it was, because that is what was shared.
  const answered = data.overrides[share.verdict.groupKey] ?? null;
  const asked = share.verdict.asked === true;
  const copy = data.copy;
  const ui = copy.ui as Record<string, string>;

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-20 pt-10">
      <p className="label">
        {ui.sharedHandle} / shared with you
      </p>
      <h1 className="font-heading mt-2 text-5xl font-bold uppercase leading-[0.9]">
        {ui.sharedHeading}{" "}
        <span className="text-rust">
          {copy.callLabels[snapshot.call]}
        </span>
      </h1>
      <p className="mt-3 text-lg leading-snug">
        {item ? item.name : "A piece she has not talked about"}
        {item ? (
          <span className="text-muted"> / £{item.price}</span>
        ) : null}
      </p>

      <section className="mt-5 rounded-sm border border-ink/10 bg-card p-5">
        {snapshot.costPerWear !== undefined ? (
          <p className="label">
            Cost per wear £{snapshot.costPerWear.toFixed(2)}
          </p>
        ) : null}

        <ul className="space-y-2 [&:not(:first-child)]:mt-3">
          {snapshot.reasons.map((reason, i) => (
            <li key={i} className="text-[15px] leading-relaxed">
              {reason}
            </li>
          ))}
        </ul>

        {snapshot.alternative ? (
          <p className="mt-4 border-l-2 border-rust pl-3 text-[15px]">
            <span className="label block">Instead</span>
            {snapshot.alternative}
          </p>
        ) : null}

        {snapshot.caveat ? (
          <p className="mt-4 border-l-2 border-ink/20 pl-3 text-[15px]">
            <span className="label block">Caveat</span>
            {snapshot.caveat}
          </p>
        ) : null}

        {snapshot.paidDisclosure ? (
          <p className="mt-4 font-mono text-[11px] uppercase leading-relaxed tracking-[0.1em] text-muted">
            {ui.paidDisclosure}
          </p>
        ) : null}

        <p className="label mt-5 border-t border-ink/10 pt-4">
          {ui.sharedContext}
        </p>
      </section>

      {!answered && asked ? (
        <section className="mt-4 rounded-sm border border-ink/15 border-dashed p-5">
          <p className="label">Waiting on Sofia</p>
          <p className="mt-2 text-[15px] leading-relaxed">
            She has not answered this one yet. Keep this link. Her answer will
            appear here when she does.
          </p>
        </section>
      ) : null}

      {answered ? (
        <section className="mt-4 rounded-sm border border-rust/40 bg-rust/5 p-5">
          <p className="label">
            {asked ? "Sofia answered you" : "Sofia has answered this herself since"}
          </p>
          <p className="font-heading mt-1 text-2xl font-semibold uppercase text-rust">
            {copy.callLabels[answered.call]}
          </p>
          {answered.reasons.map((reason, i) => (
            <p key={i} className="mt-2 text-[15px] leading-relaxed">
              {reason}
            </p>
          ))}
        </section>
      ) : null}

      <BuyTap shareRef={ref} link={item?.link ?? null} />

      {item ? (
        <Link href={`/s/${item.id}`} className="label mt-6 inline-block">
          Get your own answer on this &rarr;
        </Link>
      ) : (
        <Link href="/" className="label mt-6 inline-block">
          See what she has talked about &rarr;
        </Link>
      )}
    </main>
  );
}
