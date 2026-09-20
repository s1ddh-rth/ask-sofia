"use client";

import { useEffect, useState } from "react";
import { checkins, seen } from "@/lib/local";
import { track } from "@/lib/track";

// The question an affiliate click can never answer.
//
// E-09 says 62% of high value buyers never clicked her link and the median
// gap between saving and buying is 3.4 days. So the only way to know whether
// her judgement led to a purchase is to ask, once, anonymously, when someone
// comes back. One tap, four answers, and it never asks again for that piece.
const ANSWERS: Array<{ key: string; label: string }> = [
  { key: "her-link", label: "Through her link" },
  { key: "somewhere-else", label: "Somewhere else" },
  { key: "not-buying", label: "Not buying it" },
  { key: "still-deciding", label: "Still deciding" },
];

export default function CheckIn({
  itemId,
  itemName,
}: {
  itemId: string;
  itemName: string;
}) {
  const [show, setShow] = useState(false);
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    // Only on a return visit, and only if they have not already answered.
    // This has to be an effect: localStorage does not exist while the server
    // renders, so the question can only be decided once we are in a browser.
    const isReturn = seen.isReturn(itemId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isReturn && !checkins.answered(itemId)) setShow(true);
    if (isReturn) track({ kind: "returned", itemId });
    seen.mark(itemId);
  }, [itemId]);

  if (!show) return null;

  function answer(key: string) {
    checkins.mark(itemId);
    setThanks(true);
    track({ kind: "checkin", itemId, detail: key });
  }

  if (thanks) {
    return (
      <section className="mt-6 rounded-sm border border-ink/15 border-dashed p-4">
        <p className="text-[15px]">
          Thank you. That is the part her affiliate link cannot see.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-sm border border-rust/40 bg-rust/5 p-4">
      <p className="label">
        You looked at the {itemName.toLowerCase()} before
      </p>
      <p className="font-heading mt-1 text-xl font-semibold uppercase">
        Did you buy it?
      </p>
      <p className="mt-1 text-[13px] text-muted">
        One tap, anonymous, and it helps Sofia know what her judgement is
        actually worth.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ANSWERS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => answer(a.key)}
            className="rounded-sm border border-ink/15 bg-card px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink"
          >
            {a.label}
          </button>
        ))}
      </div>
    </section>
  );
}
