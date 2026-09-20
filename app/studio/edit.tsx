"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Item, Stock, VerdictType } from "@/lib/engine/types";

const TYPES: VerdictType[] = [
  "investment",
  "basic",
  "statement",
  "situational",
  "avoid",
];
const STOCKS: Stock[] = ["in", "low", "one-off", "out"];

export default function EditItem({
  items,
  takeLabels,
}: {
  items: Item[];
  takeLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [id, setId] = useState(items[0]?.id ?? "");
  const current = items.find((i) => i.id === id);

  const [quote, setQuote] = useState(current?.quote ?? "");
  const [price, setPrice] = useState(String(current?.price ?? ""));
  const [stock, setStock] = useState<Stock>(current?.stock ?? "in");
  const [type, setType] = useState<VerdictType>(
    current?.verdictType ?? "investment",
  );
  const [stage, setStage] = useState<"idle" | "confirm" | "saving" | "done">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  function pick(nextId: string) {
    const next = items.find((i) => i.id === nextId);
    setId(nextId);
    setQuote(next?.quote ?? "");
    setPrice(String(next?.price ?? ""));
    setStock(next?.stock ?? "in");
    setType(next?.verdictType ?? "investment");
    setStage("idle");
    setError(null);
  }

  // Only the fields she actually moved get written, so a patch stays a patch.
  const change: Record<string, unknown> = {};
  if (current) {
    if (quote !== current.quote) change.quote = quote;
    if (Number(price) !== current.price) change.price = Number(price);
    if (stock !== current.stock) change.stock = stock;
    if (type !== current.verdictType) change.verdictType = type;
  }
  const changed = Object.keys(change).length > 0;
  const priceValid = price.trim() !== "" && Number.isFinite(Number(price));

  async function save() {
    setStage("saving");
    setError(null);
    try {
      const res = await fetch("/api/patch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target: id,
          change,
          reason: "Edited directly in the studio",
          confirmed: true,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setError(d?.detail ?? "That change was refused.");
        setStage("confirm");
        return;
      }
      setStage("done");
      router.refresh();
    } catch {
      setError("Could not save. Try once more.");
      setStage("confirm");
    }
  }

  return (
    <div className="mt-3 rounded-sm border border-ink/10 bg-card p-4">
      <p className="label">Piece</p>
      <select
        value={id}
        onChange={(e) => pick(e.target.value)}
        className="mt-1 w-full rounded-sm border border-ink/15 bg-paper px-3 py-2 text-[15px] outline-none focus:border-rust"
      >
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>

      <p className="label mt-4">Her words on it</p>
      <input
        value={quote}
        onChange={(e) => {
          setQuote(e.target.value);
          setStage("idle");
        }}
        maxLength={200}
        className="mt-1 w-full rounded-sm border border-ink/15 bg-paper px-3 py-2 text-[15px] outline-none focus:border-rust"
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="label">Price</p>
          <input
            value={price}
            inputMode="decimal"
            onChange={(e) => {
              setPrice(e.target.value);
              setStage("idle");
            }}
            className="mt-1 w-full rounded-sm border border-ink/15 bg-paper px-3 py-2 text-[15px] outline-none focus:border-rust"
          />
        </div>
        <div>
          <p className="label">Stock</p>
          <select
            value={stock}
            onChange={(e) => {
              setStock(e.target.value as Stock);
              setStage("idle");
            }}
            className="mt-1 w-full rounded-sm border border-ink/15 bg-paper px-3 py-2 text-[15px] outline-none focus:border-rust"
          >
            {STOCKS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="label mt-4">How you think about it</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setType(t);
              setStage("idle");
            }}
            aria-pressed={type === t}
            className={`rounded-sm border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] ${
              type === t
                ? "border-rust bg-rust text-card"
                : "border-ink/15 text-muted"
            }`}
          >
            {takeLabels[t] ?? t}
          </button>
        ))}
      </div>

      {stage === "done" ? (
        <p className="mt-4 border-l-2 border-rust pl-3 text-[15px]">
          Saved as a patch. It is live, and the previous version is still in
          the history.
        </p>
      ) : stage === "confirm" || stage === "saving" ? (
        <div className="mt-4 rounded-sm border border-rust/40 bg-rust/5 p-3">
          <p className="label">Exactly what this changes</p>
          <pre className="mt-1 overflow-x-auto font-mono text-[11px] leading-relaxed">
            {id}
            {"\n"}
            {JSON.stringify(change, null, 2)}
          </pre>
          {error ? (
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-rust">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={stage === "saving"}
              className="rounded-sm bg-rust px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-card disabled:opacity-60"
            >
              {stage === "saving" ? "Saving" : "Confirm and make live"}
            </button>
            <button
              type="button"
              onClick={() => setStage("idle")}
              className="rounded-sm border border-ink/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted"
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setStage("confirm")}
          disabled={!changed || !priceValid}
          className="mt-4 rounded-sm bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-card disabled:opacity-40"
        >
          {changed ? "Review the change" : "Nothing changed yet"}
        </button>
      )}
    </div>
  );
}
