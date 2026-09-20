import Link from "next/link";
import { countShare, getShare, loadLive } from "@/lib/store";
import BuyTap from "./buy";

export const dynamic = "force-dynamic";

const CALL_CLASS: Record<string, string> = {
  BUY: "stamp",
  WAIT: "stamp",
  SKIP: "stamp",
  ESCALATE: "stamp",
};

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
          See what she has written about &rarr;
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
  const copy = data.copy;

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-20 pt-10">
      <p className="label">Sofia&rsquo;s verdict</p>
      <h1 className="font-heading mt-2 text-4xl font-bold uppercase leading-[0.95]">
        {item ? item.name : "A piece she has not written about"}
      </h1>
      {item ? (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          {[item.category, `£${item.price}`].filter(Boolean).join(" / ")}
        </p>
      ) : null}

      <section className="mt-6 rounded-sm border border-ink/10 bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <span className={`${CALL_CLASS[snapshot.call]} px-3 py-2 text-3xl`}>
            {copy.callLabels[snapshot.call]}
          </span>
          {snapshot.costPerWear !== undefined ? (
            <span className="text-right">
              <span className="label block">Cost per wear</span>
              <span className="font-heading text-2xl font-bold">
                £{snapshot.costPerWear.toFixed(2)}
              </span>
            </span>
          ) : null}
        </div>

        <ul className="mt-5 space-y-2">
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
            {(copy.ui as Record<string, string>).paidDisclosure}
          </p>
        ) : null}

        <p className="label mt-5 border-t border-ink/10 pt-4">
          This was her answer for one person&rsquo;s wardrobe and budget. Yours
          may differ.
        </p>
      </section>

      {answered ? (
        <section className="mt-4 rounded-sm border border-rust/40 bg-rust/5 p-5">
          <p className="label">Sofia has answered this herself since</p>
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
          See what she has written about &rarr;
        </Link>
      )}
    </main>
  );
}
