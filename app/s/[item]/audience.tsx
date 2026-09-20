"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { decide } from "@/lib/engine/decide";
import { groupKey } from "@/lib/engine/keys";
import { parseFallback } from "@/lib/parse/fallback";
import { questions, saved, seen } from "@/lib/local";
import { track } from "@/lib/track";
import MyStuff from "./mine";
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
  first,
}: {
  label: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <div className={first ? "" : "mt-6"}>
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
  const [job, setJob] = useState<Job>("worth-it");
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [remote, setRemote] = useState<Verdict | null>(null);
  const [asking, setAsking] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [backLink, setBackLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      job,
    });
  }, [touched, asked, subject, context, rules, copy, byId, overrides, key, job]);

  // A typed question is answered by the server, which has Groq in front of
  // the keyword matcher. The local verdict shows first so nothing waits, and
  // it stands if the request fails.
  const shown = remote ?? verdict;

  // Taps are logged for her queue. The verdict on screen never waits on this,
  // and a failed log changes nothing the person sees. Typed questions log
  // themselves through the same route that answers them.
  const logged = useRef<string>("");
  useEffect(() => {
    if (!verdict || asked) return;
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
    setJob("worth-it");
    setThanks(false);
    setRemote(null);
    setShareLink(null);
  }

  function toggleOwn(tag: string) {
    reset();
    setOwns((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  async function askQuestion() {
    const text = question.trim();
    if (!text) return;

    // Answer from the keyword matcher straight away so nothing waits.
    const parsed = parseFallback(text, items, ownedTags);
    const local = {
      wear: parsed.wear ?? wear,
      budgetGBP: parsed.budgetGBP ?? budget,
      owns: parsed.owns.length > 0 ? parsed.owns : owns,
      occasion: parsed.occasion ?? (occasion || undefined),
    };
    setJob(parsed.job);
    setThanks(false);
    setRemote(null);
    setAsked(local);
    setAskedItem(parsed.itemId ? (byId[parsed.itemId] ?? null) : item);

    // Then let the server read it properly and log it.
    setAsking(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rawText: text,
          fallbackItemId: item?.id ?? null,
          context: { wear, budgetGBP: budget, owns, occasion: occasion || null },
        }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d?.verdict) setRemote(d.verdict as Verdict);
        if (d?.job) setJob(d.job);
        if (d?.questionId) setQuestionId(d.questionId);
        setAskedItem(d?.itemId ? (byId[d.itemId] ?? null) : item);
      }
    } catch {
      // The local answer already on screen stands.
    } finally {
      setAsking(false);
    }
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
          note,
          rawText: question.trim() || null,
        }),
      });
      if (res.ok) {
        const d = await res.json().catch(() => null);
        if (d?.path) {
          setBackLink(`${window.location.origin}${d.path}`);
          if (d?.ref) {
            questions.add({
              ref: d.ref,
              path: d.path,
              itemId: subject?.id ?? itemSlug,
              itemName: subject?.name ?? itemSlug.replace(/-/g, " "),
              askedAt: new Date().toISOString(),
            });
          }
        }
        setSent("done");
      } else {
        setSent("failed");
      }
    } catch {
      setSent("failed");
    }
  }

  // The share is a snapshot of this verdict, not a link to this page, because
  // the answer was theirs and the page would give the next person a different
  // one.
  async function share() {
    if (sharing) return;
    setSharing(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: subject?.id ?? null, job, context }),
      });
      if (!res.ok) throw new Error("share failed");
      const d = await res.json();
      const url = `${window.location.origin}${d.path}`;
      setShareLink(url);
      track({
        kind: "shared",
        itemId: subject?.id ?? null,
        groupKey: key,
        verdictCall: shown?.call ?? null,
        ref: d.ref ?? null,
      });
      if (navigator.share) {
        await navigator
          .share({ title: "Sofia's verdict", url })
          .catch(() => {});
      } else {
        await navigator.clipboard?.writeText(url).catch(() => {});
      }
    } catch {
      setShareLink(null);
    } finally {
      setSharing(false);
    }
  }

  const [isSaved, setIsSaved] = useState(false);

  // Whether this piece is already on their shortlist, read after mount so the
  // server and the browser never disagree.
  useEffect(() => {
    // Same reason: the shortlist lives in localStorage, which only exists
    // once this is running in a browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (subject) setIsSaved(saved.has(subject.id));
  }, [subject]);

  // A verdict being seen is the first thing worth counting, because the
  // decision starts here and finishes days later somewhere we cannot see.
  const seenLogged = useRef("");
  useEffect(() => {
    if (!shown || !subject) return;
    const sig = `${subject.id}:${shown.call}`;
    if (seenLogged.current === sig) return;
    seenLogged.current = sig;
    track({
      kind: "shown",
      itemId: subject.id,
      groupKey: key,
      verdictCall: shown.call,
    });
  }, [shown, subject, key]);

  function toggleSave() {
    if (!subject || !shown) return;
    const nowSaved = saved.toggle({
      itemId: subject.id,
      name: subject.name,
      call: shown.call,
      job,
      context: context as unknown as Record<string, unknown>,
      savedAt: new Date().toISOString(),
    });
    setIsSaved(nowSaved);
    seen.mark(subject.id);
    if (nowSaved) {
      track({
        kind: "saved",
        itemId: subject.id,
        groupKey: key,
        verdictCall: shown.call,
      });
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
      {item ? null : (
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
          <Section label={ui.wearLabel} first>
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
            disabled={asking}
            className="rounded-sm bg-ink px-4 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-card active:opacity-80 disabled:opacity-60"
          >
            {asking ? "..." : "Ask"}
          </button>
        </div>
      </div>

      {shown ? (
        <VerdictCard
          verdict={shown}
          copy={copy}
          onThumbsDown={thumbsDown}
          thanks={thanks}
          onShare={share}
          sharing={sharing}
          shareLink={shareLink}
          onSave={toggleSave}
          isSaved={isSaved}
        />
      ) : null}

      <MyStuff callLabels={copy.callLabels} />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-paper/95 backdrop-blur">
        <div className="mx-auto w-full max-w-5xl px-5 py-3">
          {barOpen ? (
            <div>
              <p className="label">{ui.askBarTitle}</p>
              {sent === "done" ? (
                <div className="mt-2">
                  <p className="text-[15px]">
                    Sent to Sofia with your answers and the verdict you got.
                  </p>
                  {backLink ? (
                    <>
                      <p className="mt-2 text-[15px]">
                        Save this, Sofia&rsquo;s answer will appear here.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <a
                          href={backLink}
                          className="min-w-0 flex-1 truncate rounded-sm border border-ink/15 bg-card px-3 py-2 font-mono text-[11px] tracking-[0.05em] text-rust"
                        >
                          {backLink}
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setCopied(true);
                            navigator.clipboard
                              ?.writeText(backLink)
                              .catch(() => {});
                          }}
                          className="shrink-0 rounded-sm border border-ink/15 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted"
                        >
                          {copied ? "Copied" : "Copy"}
                        </button>
                        {typeof navigator !== "undefined" && navigator.share ? (
                          <button
                            type="button"
                            onClick={() => {
                              navigator
                                .share({
                                  title: "My question for Sofia",
                                  url: backLink,
                                })
                                .catch(() => {});
                            }}
                            className="shrink-0 rounded-sm border border-ink/15 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted"
                          >
                            Send
                          </button>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
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
              <span className="font-heading text-base font-semibold uppercase leading-tight sm:text-lg">
                {ui.askBarTitle}
              </span>
              <span className="shrink-0 pl-3 font-mono text-[11px] uppercase tracking-[0.1em]">
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
  onShare,
  sharing,
  shareLink,
  onSave,
  isSaved,
}: {
  verdict: Verdict;
  copy: Copy;
  onThumbsDown: () => void;
  thanks: boolean;
  onShare: () => void;
  sharing: boolean;
  shareLink: string | null;
  onSave: () => void;
  isSaved: boolean;
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
          onClick={onSave}
          aria-pressed={isSaved}
          className={`rounded-sm border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] ${
            isSaved
              ? "border-rust bg-rust text-card"
              : "border-ink/15 text-muted"
          }`}
        >
          {isSaved ? "Saved" : "Save"}
        </button>
        <button
          type="button"
          onClick={onShare}
          disabled={sharing}
          className="rounded-sm border border-ink/15 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted disabled:opacity-60"
        >
          {sharing ? "..." : shareLink ? "Link copied" : "Share"}
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

      {shareLink ? (
        <p className="mt-3 break-all font-mono text-[11px] tracking-[0.05em] text-muted">
          {shareLink}
        </p>
      ) : null}
    </section>
  );
}
