// What to put in front of Sofia. Pure counting, no model, no I/O.
//
// These only ever propose. Nothing here changes the live app, because
// approving is her action and approving is what writes a patch.

import type {
  Item,
  OverrideAnswer,
  Patch,
  Rules,
  Verdict,
} from "@/lib/engine/types";

export type Suggestion = {
  id: string;
  kind: "repeated-answer" | "needs-review";
  headline: string;
  because: string;
  groupKey: string;
  itemId: string | null;
  count: number;
  // What approving would write. Null means there is nothing safe to propose
  // automatically and she should look at it herself.
  patch: Patch | null;
};

export type QuestionLike = {
  group_key: string | null;
  item_id: string | null;
  feedback: string | null;
  verdict: Verdict | null;
};

// Her repeated answer, encoded as something the engine can say on its own.
// Deliberately narrow. Anything it cannot express faithfully proposes no
// patch rather than guessing at one.
function patchFor(
  itemId: string,
  answer: OverrideAnswer,
  count: number,
): Patch | null {
  const words = answer.reasons[0];
  if (!words) return null;
  const reason = `She gave this answer to ${count} people asking the same thing`;

  if (answer.call === "SKIP") {
    return {
      target: itemId,
      change: { caveat: { text: words, severity: "hard" } },
      reason,
    };
  }
  if (answer.call === "WAIT") {
    return {
      target: itemId,
      change: { caveat: { text: words, severity: "soft" } },
      reason,
    };
  }
  if (answer.call === "BUY") {
    return { target: itemId, change: { buyAgain: true }, reason };
  }
  return null;
}

export function suggest({
  questions,
  overrides,
  byId,
  rules,
}: {
  questions: QuestionLike[];
  overrides: Record<string, OverrideAnswer>;
  byId: Record<string, Item>;
  rules: Rules;
}): Suggestion[] {
  const asked = new Map<string, number>();
  const down = new Map<string, number>();
  const itemOf = new Map<string, string | null>();

  for (const q of questions) {
    const key = q.group_key;
    if (!key) continue;
    asked.set(key, (asked.get(key) ?? 0) + 1);
    if (!itemOf.has(key)) itemOf.set(key, q.item_id);
    if (q.feedback === "down") down.set(key, (down.get(key) ?? 0) + 1);
  }

  const out: Suggestion[] = [];

  // One. She has answered a group, and that one answer is standing in for a
  // lot of people asking the same thing. That is a rule, not a reply.
  for (const [key, answer] of Object.entries(overrides)) {
    const count = asked.get(key) ?? 0;
    if (count < rules.suggestAfterRepeats) continue;
    const itemId = itemOf.get(key) ?? null;
    const name = itemId ? (byId[itemId]?.name ?? itemId) : "an unknown piece";
    out.push({
      id: `repeat:${key}`,
      kind: "repeated-answer",
      headline: `Make your answer on the ${name.toLowerCase()} a rule`,
      because: `${count} people asked this and your answer covered all of them. Putting it in the data means the engine says it without waiting for you.`,
      groupKey: key,
      itemId,
      count,
      patch: itemId ? patchFor(itemId, answer, count) : null,
    });
  }

  // Two. Enough people have told us a verdict was not useful. No patch is
  // proposed, because the whole point is that we do not know what is wrong.
  for (const [key, count] of down) {
    if (count < rules.reviewAfterThumbsDown) continue;
    const itemId = itemOf.get(key) ?? null;
    const name = itemId ? (byId[itemId]?.name ?? itemId) : "an unknown piece";
    out.push({
      id: `review:${key}`,
      kind: "needs-review",
      headline: `Look at the ${name.toLowerCase()} again`,
      because: `${count} people marked this verdict as not useful. Either the answer is wrong or the piece has changed.`,
      groupKey: key,
      itemId,
      count,
      patch: null,
    });
  }

  // Loudest first, and reviews above proposals because something is wrong.
  return out.sort(
    (a, b) =>
      Number(b.kind === "needs-review") - Number(a.kind === "needs-review") ||
      b.count - a.count,
  );
}
