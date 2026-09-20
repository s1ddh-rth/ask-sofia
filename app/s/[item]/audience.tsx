"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { decide } from "@/lib/engine/decide";
import { groupKey } from "@/lib/engine/keys";
import { parseFallback } from "@/lib/parse/fallback";
import type {
  Copy,
  Item,
  Job,
  OverrideAnswer,
  Rules,
  UserContext,
  Verdict,
  Wear,
} from "@/lib/engine/types";

type Props = {
  item: Item | null;
  itemSlug: string;
  items: Item[];
  byId: Record<string, Item>;
  rules: Rules;
  copy: Copy;
  ownedTags: string[];
  overrides: Record<string, OverrideAnswer>;
};

const WEARS: Wear[] = ["weekly", "few", "occasional"];
const BUDGETS = [50, 100, 150, 250];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-sm border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${
        active
          ? "border-rust bg-rust text-card"
          : "border-ink/15 bg-card text-muted active:bg-ink/5"
      }`}
    >
      {children}
    </button>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <p className="label">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export default function Audience({
  item,
  itemSlug,
  items,
  byId,
  rules,
  copy,
  ownedTags,
  overrides,
}: Props) {
  const ui = copy.ui as Record<string, string>;
  const wearOptions = copy.ui.wearOptions as Record<string, string>;

  const [wear, setWear] = useState<Wear | undefined>();
  const [budget, setBudget] = useState<number | undefined>();
  const [owns, setOwns] = useState<string[]>([]);
  const [occasion, setOccasion] = useState(false);
  const [touched, setTouched] = useState(false);

  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<UserContext | null>(null);
  const [askedItem, setAskedItem] = useState<Item | null>(null);
  const [job, setJob] = useState<Job>("should-buy");
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);

  const [barOpen, setBarOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<"idle" | "sending" | "done" | "failed">(
    "idle",
  );

  const context: UserContext = useMemo(
    () =>
      asked ?? {
        wear,
        budgetGBP: budget,
        owns,
        occasion: occasion || undefined,
      },
    [asked, wear, budget, owns, occasion],
  );

  const subject = asked ? askedItem : item;
  const key = groupKey(subject?.id ?? null, job);

  const verdict: Verdict | null = useMemo(() => {
    if (!touched && !asked) return null;
    return decide({
      item: subject,
      context,
      rules,
      copy,
      byId,
      override: overrides[key] ?? null,
    });
  }, [touched, asked, subject, context, rules, copy, byId, overrides, key]);

  // Every ask is logged for her queue. The verdict on screen never waits on
  // this, and a failed log changes nothing the person sees.
  const logged = useRef<string>("");
  useEffect(() => {
    if (!verdict) return;
    const signature = JSON.stringify({ key, context });
    if (logged.current === signature) return;
    const timer = setTimeout(() => {
      logged.current = signature;
      fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          itemId: subject?.id ?? null,
          job,
          context,
          rawText: asked ? question.trim() || null : null,
          source: asked ? "fallback" : "taps",
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.questionId) setQuestionId(d.questionId);
        })
        .catch(() => {});
    }, 700);
    return () => clearTimeout(timer);
  }, [verdict, key, context, subject, job, asked, question]);

  function reset() {
    setTouched(true);
    setAsked(null);
    setJob("should-buy");
    setThanks(false);
  }

  function toggleOwn(tag: string) {
    reset();
    setOwns((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function askQuestion() {
    const text = question.trim();
    if (!text) return;
    const parsed = parseFallback(text, items, ownedTags);
    setJob(parsed.job);
    setThanks(false);
    setAsked({
      wear: parsed.wear ?? wear,
      budgetGBP: parsed.budgetGBP ?? budget,
      owns: parsed.owns.length > 0 ? parsed.owns : owns,
      occasion: parsed.occasion ?? (occasion || undefined),
    });
    setAskedItem(parsed.itemId ? (byId[parsed.itemId] ?? null) : item);
  }

  async function sendToSofia() {
    setSent("sending");
    try {
      const res = await fetch("/api/escalate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          itemId: subject?.id ?? itemSlug,
          job,
          context,
          verdict,
          note,
          rawText: question.trim() || null,
        }),
      });
      setSent(res.ok ? "done" : "failed");
    } catch {
      setSent("failed");
    }
  }

  async function thumbsDown() {
    setThanks(true);
    if (!questionId) return;
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId, feedback: "down" }),
      });
    } catch {
      // The thank you stands either way. Nothing here is worth an error.
    }
  }

  return (
    <>
      {item ? (
        <section className="mt-6 rounded-sm border border-ink/10 bg-card p-5">
          <p className="label">{ui.takeLabel}</p>
          <p className="font-heading mt-1 text-2xl font-semibold uppercase text-rust">
            {copy.takeLabels[item.verdictType]}
          </p>
          <p className="mt-3 text-lg italic leading-snug">
            &ldquo;{item.quote}&rdquo;
          </p>
        </section>
      ) : (
        <section className="mt-6 rounded-sm border border-ink/10 bg-card p-5">
          <p className="label">{ui.takeLabel}</p>
          <p className="mt-2 text-[15px] leading-relaxed">
            {copy.reasons.escalateUnknown} Use the bar below and she will answer
            it herself.
          </p>
        </section>
      )}

      {item ? (
        <>
          <Section label={ui.wearLabel}>
            {WEARS.map((w) => (
              <Chip
                key={w}
                active={wear === w}
                onClick={() => {
                  reset();
                  setWear(wear === w ? undefined : w);
                }}
              >
                {wearOptions[w]}
              </Chip>
            ))}
          </Section>

          <Section label={ui.budgetLabel}>
            {BUDGETS.map((b) => (
              <Chip
                key={b}
                active={budget === b}
                onClick={() => {
                  reset();
                  setBudget(budget === b ? undefined : b);
                }}
              >
                £{b}
              </Chip>
            ))}
          </Section>

          <Section label={ui.ownsLabel}>
            {ownedTags.map((tag) => (
              <Chip
                key={tag}
                active={owns.includes(tag)}
                onClick={() => toggleOwn(tag)}
              >
                {tag.replace(/-/g, " ")}
              </Chip>
            ))}
          </Section>

          <Section label={ui.occasionLabel}>
            <Chip
              active={occasion}
              onClick={() => {
                reset();
                setOccasion(!occasion);
              }}
            >
              Yes, somewhere to be
            </Chip>
          </Section>
        </>
      ) : null}

      <div className="mt-8">
        <p className="label">Or ask in your own words</p>
        <div className="mt-2 flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") askQuestion();
            }}
            maxLength={500}
            placeholder={ui.questionPlaceholder}
            className="min-w-0 flex-1 rounded-sm border border-ink/15 bg-card px-3 py-3 text-[15px] outline-none placeholder:text-muted/70 focus:border-rust"
          />
          <button
            type="button"
            onClick={askQuestion}
            className="rounded-sm bg-ink px-4 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-card active:opacity-80"
          >
            Ask
          </button>
        </div>
      </div>

      {verdict ? (
        <VerdictCard
          verdict={verdict}
          copy={copy}
          onThumbsDown={thumbsDown}
          thanks={thanks}
        />
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-paper/95 backdrop-blur">
        <div className="mx-auto w-full max-w-md px-5 py-3">
          {barOpen ? (
            <div>
              <p className="label">{ui.askBarTitle}</p>
              {sent === "done" ? (
                <p className="mt-2 text-[15px]">
                  Sent to Sofia with your answers and the verdict you got. She
                  replies in her studio.
                </p>
              ) : (
                <>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Anything else she should know? Optional."
                    className="mt-2 w-full resize-none rounded-sm border border-ink/15 bg-card px-3 py-2 text-[15px] outline-none placeholder:text-muted/70 focus:border-rust"
                  />
                  {sent === "failed" ? (
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-rust">
                      Could not send. Try once more.
                    </p>
                  ) : null}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={sendToSofia}
                      disabled={sent === "sending"}
                      className="flex-1 rounded-sm bg-rust px-4 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-card disabled:opacity-60"
                    >
                      {sent === "sending" ? "Sending" : ui.askBarAction}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBarOpen(false)}
                      className="rounded-sm border border-ink/15 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setBarOpen(true)}
              className="flex w-full items-center justify-between rounded-sm bg-rust px-4 py-3 text-card"
            >
              <span className="font-heading text-lg font-semibold uppercase">
                {ui.askBarTitle}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.1em]">
                {ui.askBarAction}
              </span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function VerdictCard({
  verdict,
  copy,
  onThumbsDown,
  thanks,
}: {
  verdict: Verdict;
  copy: Copy;
  onThumbsDown: () => void;
  thanks: boolean;
}) {
  const ui = copy.ui as Record<string, string>;
  return (
    <section className="mt-8 rounded-sm border border-ink/10 bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <span className="stamp px-3 py-2 text-3xl">
          {copy.callLabels[verdict.call]}
        </span>
        {verdict.costPerWear !== undefined ? (
          <span className="text-right">
            <span className="label block">Cost per wear</span>
            <span className="font-heading text-2xl font-bold">
              £{verdict.costPerWear.toFixed(2)}
            </span>
          </span>
        ) : null}
      </div>

      <ul className="mt-5 space-y-2">
        {verdict.reasons.map((reason, i) => (
          <li key={i} className="text-[15px] leading-relaxed">
            {reason}
          </li>
        ))}
      </ul>

      {verdict.alternative ? (
        <p className="mt-4 border-l-2 border-rust pl-3 text-[15px]">
          <span className="label block">Instead</span>
          {verdict.alternative}
        </p>
      ) : null}

      {verdict.caveat ? (
        <p className="mt-4 border-l-2 border-ink/20 pl-3 text-[15px]">
          <span className="label block">Caveat</span>
          {verdict.caveat}
        </p>
      ) : null}

      {verdict.paidDisclosure ? (
        <p className="mt-4 font-mono text-[11px] uppercase leading-relaxed tracking-[0.1em] text-muted">
          {ui.paidDisclosure}
        </p>
      ) : null}

      <div className="mt-5 flex items-center gap-2 border-t border-ink/10 pt-4">
        <button
          type="button"
          className="rounded-sm border border-ink/15 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted"
        >
          Share
        </button>
        <button
          type="button"
          onClick={onThumbsDown}
          disabled={thanks}
          aria-label="This was not useful"
          className="rounded-sm border border-ink/15 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted disabled:opacity-50"
        >
          {thanks ? "Noted" : "Not useful"}
        </button>
      </div>
    </section>
  );
}
