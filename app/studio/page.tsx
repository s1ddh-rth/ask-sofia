import Link from "next/link";
import {
  listPosts,
  listQuestions,
  listShares,
  loadLive,
  supabaseConfigured,
} from "@/lib/store";
import { suggest } from "@/lib/suggest/heuristics";
import EditItem from "./edit";
import Queue, { type Group } from "./queue";
import Posts, { type PostView } from "./posts";
import Suggestions from "./suggestions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Studio — Ask Sofia",
};

export default async function StudioPage() {
  const [data, questions, shares, posts] = await Promise.all([
    loadLive(),
    listQuestions(),
    listShares(),
    listPosts(),
  ]);

  const groups = new Map<string, Group>();
  for (const q of questions) {
    const key = q.group_key ?? "unknown:other";
    const existing = groups.get(key);
    const itemName = q.item_id
      ? (data.byId[q.item_id]?.name ?? q.item_id.replace(/-/g, " "))
      : "Something she has not written about";

    if (!existing) {
      groups.set(key, {
        key,
        itemId: q.item_id,
        itemName,
        job: q.job ?? "other",
        count: 1,
        escalated: q.escalated ? 1 : 0,
        thumbsDown: q.feedback === "down" ? 1 : 0,
        notes: q.note ? [q.note] : [],
        questions: q.raw_text ? [q.raw_text] : [],
        lastCall: q.verdict?.call ?? null,
        ruleFired: q.rule_fired,
        override: data.overrides[key] ?? null,
      });
      continue;
    }
    existing.count += 1;
    if (q.escalated) existing.escalated += 1;
    if (q.feedback === "down") existing.thumbsDown += 1;
    if (q.note && existing.notes.length < 4) existing.notes.push(q.note);
    if (q.raw_text && existing.questions.length < 4)
      existing.questions.push(q.raw_text);
  }

  const ordered = [...groups.values()].sort(
    (a, b) => b.escalated - a.escalated || b.count - a.count,
  );

  const totals = {
    asked: questions.length,
    escalated: questions.filter((q) => q.escalated).length,
    groups: ordered.length,
    answered: Object.keys(data.overrides).length,
    opens: shares.reduce((n, s) => n + (s.opens ?? 0), 0),
    buyTaps: shares.reduce((n, s) => n + (s.buy_taps ?? 0), 0),
  };

  const postViews: PostView[] = posts.map((post) => {
    const perThousand =
      post.views && post.views > 0
        ? Math.round(((post.purchases ?? 0) / post.views) * 1000 * 100) / 100
        : 0;
    return {
      id: post.id,
      title: post.title,
      views: post.views,
      purchases: post.purchases,
      item_ids: post.item_ids,
      status: post.status,
      perThousand,
      quietWinner: perThousand >= data.rules.quietWinnerPer1000Views,
      itemNames: (post.item_ids ?? []).map(
        (id) => data.byId[id]?.name ?? id,
      ),
    };
  });

  const suggestions = suggest({
    questions,
    overrides: data.overrides,
    byId: data.byId,
    rules: data.rules,
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-20 pt-10">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="label">Case 002 / Her desk</p>
          <h1 className="font-heading mt-1 text-4xl font-bold uppercase leading-[0.95]">
            Studio
          </h1>
        </div>
        <Link href="/" className="label">
          Audience view &rarr;
        </Link>
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-2">
        {[
          ["Asked", totals.asked],
          ["For you", totals.escalated],
          ["Groups", totals.groups],
          ["Answered", totals.answered],
          ["Shares opened", totals.opens],
          ["Buy taps", totals.buyTaps],
        ].map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-sm border border-ink/10 bg-card px-3 py-3"
          >
            <dt className="label">{label}</dt>
            <dd className="font-heading text-3xl font-bold leading-none">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {!supabaseConfigured ? (
        <p className="mt-4 rounded-sm border border-rust/30 bg-rust/5 px-3 py-2 font-mono text-[11px] uppercase leading-relaxed tracking-[0.1em] text-rust">
          Running on in-memory state. Answers last until the server restarts.
        </p>
      ) : null}

      <h2 className="label mt-10">The queue, grouped</h2>

      {ordered.length === 0 ? (
        <p className="mt-3 rounded-sm border border-ink/10 bg-card px-4 py-6 text-[15px] text-muted">
          Nothing yet. Questions land here the moment someone taps the Ask
          Sofia bar.
        </p>
      ) : (
        <Queue groups={ordered} />
      )}

      <h2 className="label mt-10">What the logs suggest</h2>
      <Suggestions items={suggestions} />

      <h2 className="label mt-10">Her posts</h2>
      <Posts posts={postViews} threshold={data.rules.quietWinnerPer1000Views} />

      <h2 className="label mt-10">Change a piece</h2>
      <EditItem items={data.items} takeLabels={data.copy.takeLabels} />
    </main>
  );
}
