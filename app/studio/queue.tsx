"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Call, OverrideAnswer } from "@/lib/engine/types";

export type Group = {
  key: string;
  itemId: string | null;
  itemName: string;
  job: string;
  count: number;
  escalated: number;
  thumbsDown: number;
  notes: string[];
  questions: string[];
  lastCall: string | null;
  ruleFired: string | null;
  override: OverrideAnswer | null;
};

const CALLS: Call[] = ["BUY", "WAIT", "SKIP"];

const CALL_WORDS: Record<string, string> = {
  BUY: "Buy it",
  WAIT: "Wait",
  SKIP: "Skip it",
  ESCALATE: "Ask Sofia",
};

export default function Queue({
  groups,
  jobLabels,
  ruleLabels,
}: {
  groups: Group[];
  // Her interface should not show her the keys this app files things under.
  jobLabels: Record<string, string>;
  ruleLabels: Record<string, string>;
}) {
  return (
    <ul className="mt-3 space-y-3">
      {groups.map((group) => (
        <li key={group.key}>
          <GroupCard
            group={group}
            jobLabels={jobLabels}
            ruleLabels={ruleLabels}
          />
        </li>
      ))}
    </ul>
  );
}

function GroupCard({
  group,
  jobLabels,
  ruleLabels,
}: {
  group: Group;
  jobLabels: Record<string, string>;
  ruleLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [call, setCall] = useState<Call>("WAIT");
  const [words, setWords] = useState("");
  const [stage, setStage] = useState<"idle" | "confirm" | "saving" | "saved">(
    group.override ? "saved" : "idle",
  );
  const [failed, setFailed] = useState(false);

  const draft: OverrideAnswer = { call, reasons: [words.trim()] };

  async function save() {
    setStage("saving");
    setFailed(false);
    try {
      const res = await fetch("/api/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          groupKey: group.key,
          answer: draft,
          confirmed: true,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setStage("saved");
      router.refresh();
    } catch {
      setFailed(true);
      setStage("confirm");
    }
  }

  const live = group.override;

  return (
    <div className="rounded-sm border border-ink/10 bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-heading text-2xl font-semibold uppercase leading-tight">
          {group.itemName}
        </h3>
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          {group.count} asked
        </span>
      </div>

      <p className="label mt-1">{jobLabels[group.job] ?? group.job}</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {group.escalated > 0 ? (
          <Tag>{group.escalated} for you</Tag>
        ) : null}
        {group.thumbsDown > 0 ? (
          <Tag>{group.thumbsDown} thumbs down</Tag>
        ) : null}
        {group.lastCall ? (
          <Tag>
            engine said {CALL_WORDS[group.lastCall] ?? group.lastCall}
          </Tag>
        ) : null}
        {group.ruleFired ? (
          <Tag>{ruleLabels[group.ruleFired] ?? group.ruleFired}</Tag>
        ) : null}
      </div>

      {group.questions.length > 0 ? (
        <div className="mt-3">
          <p className="label">What they typed</p>
          <ul className="mt-1 space-y-1">
            {group.questions.map((q, i) => (
              <li key={i} className="text-[15px] italic text-ink/80">
                &ldquo;{q}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {group.notes.length > 0 ? (
        <div className="mt-3">
          <p className="label">Their notes</p>
          <ul className="mt-1 space-y-1">
            {group.notes.map((n, i) => (
              <li key={i} className="text-[15px] text-ink/80">
                {n}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {stage === "saved" && live ? (
        <div className="mt-4 border-l-2 border-rust pl-3">
          <p className="label">Live answer</p>
          <p className="font-heading text-xl font-semibold uppercase text-rust">
            {CALL_WORDS[live.call] ?? live.call}
          </p>
          {live.reasons.map((r, i) => (
            <p key={i} className="mt-1 text-[15px]">
              {r}
            </p>
          ))}
        </div>
      ) : stage === "saved" ? (
        <p className="mt-4 border-l-2 border-rust pl-3 text-[15px]">
          Saved. Anyone asking this now gets your answer.
        </p>
      ) : (
        <div className="mt-4 border-t border-ink/10 pt-4">
          <p className="label">Public answer</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Shown to everyone who asks this. Do not include personal details.
          </p>

          <div className="mt-2 flex gap-2">
            {CALLS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCall(c);
                  setStage("idle");
                }}
                aria-pressed={call === c}
                className={`rounded-sm border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] ${
                  call === c
                    ? "border-rust bg-rust text-card"
                    : "border-ink/15 text-muted"
                }`}
              >
                {CALL_WORDS[c]}
              </button>
            ))}
          </div>

          <textarea
            value={words}
            onChange={(e) => {
              setWords(e.target.value);
              setStage("idle");
            }}
            rows={2}
            maxLength={600}
            placeholder="In your words. This is what everyone who asks this will read."
            className="mt-2 w-full resize-none rounded-sm border border-ink/15 bg-paper px-3 py-2 text-[15px] outline-none placeholder:text-muted/70 focus:border-rust"
          />

          {stage === "confirm" || stage === "saving" ? (
            <div className="mt-3 rounded-sm border border-rust/40 bg-rust/5 p-3">
              <p className="label">This is what goes live</p>
              <p className="font-heading mt-1 text-xl font-semibold uppercase text-rust">
                {CALL_WORDS[draft.call]}
              </p>
              <p className="mt-1 text-[15px]">{draft.reasons[0]}</p>
              <p className="label mt-2">
                Everyone who asks this about the{" "}
                {group.itemName.toLowerCase()} sees it
              </p>
              {failed ? (
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-rust">
                  Could not save. Try once more.
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
              disabled={words.trim().length === 0}
              className="mt-2 rounded-sm bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-card disabled:opacity-40"
            >
              Review it
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm border border-ink/15 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
      {children}
    </span>
  );
}
