"use client";

import { useState } from "react";

// A buy tap is worth counting whether or not she has a link on the item, so
// the count happens either way and the link is only followed when there is
// one to follow.
export default function BuyTap({
  shareRef,
  link,
}: {
  shareRef: string;
  link: string | null;
}) {
  const [tapped, setTapped] = useState(false);

  function count() {
    setTapped(true);
    try {
      void fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ ref: shareRef, event: "buy" }),
      }).catch(() => {});
    } catch {
      // Counting is never worth an error in front of someone.
    }
  }

  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={count}
        className="mt-4 block rounded-sm bg-rust px-4 py-3 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-card"
      >
        Where she got it
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={count}
      disabled={tapped}
      className="mt-4 block w-full rounded-sm border border-ink/15 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted disabled:opacity-60"
    >
      {tapped ? "She will hear you want it" : "I would buy this"}
    </button>
  );
}
