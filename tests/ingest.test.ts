import { describe, expect, it } from "vitest";
import fixture from "@/data/posts.json";

const posts = fixture.posts;
import { loadData } from "@/lib/data/load";
import { ingest, ingestPosts } from "@/lib/ingest/posts";

const { items, rules } = loadData();
const out = ingestPosts(posts, items, rules);
const byId = Object.fromEntries(out.map((p) => [p.id, p]));

describe("post ingest", () => {
  it("reads all five posts from the fixture", () => {
    expect(out).toHaveLength(5);
  });

  it("flags only the blazer post as a quiet winner", () => {
    const winners = out.filter((p) => p.quietWinner).map((p) => p.id);
    expect(winners).toEqual(["e03-4"]);
  });

  it("gets the quiet winner right for the reason it is quiet", () => {
    // 427 purchases on 28,000 views is 15.25 per thousand. The Copenhagen
    // post had six times the views and sold a fraction as much.
    expect(byId["e03-4"].perThousand).toBeCloseTo(15.25, 2);
    expect(byId["e03-2"].perThousand).toBeCloseTo(0.5, 2);
    expect(byId["e03-2"].views).toBeGreaterThan(byId["e03-4"].views);
    expect(byId["e03-2"].quietWinner).toBe(false);
  });

  it("matches a post to a piece by name", () => {
    expect(byId["e03-4"].item_ids).toContain("black-blazer");
    expect(byId["e03-4"].matchedBy).toBe("name");
  });

  it("matches nothing rather than guessing", () => {
    expect(byId["e03-2"].item_ids).toEqual([]);
    expect(byId["e03-2"].matchedBy).toBe("none");
  });

  it("never publishes, because a post is not a verdict", () => {
    for (const post of out) expect(post.status).toBe("draft");
  });

  it("does not divide by zero on a post with no views", () => {
    const [p] = ingestPosts(
      [{ id: "x", title: "Nothing", views: 0, saves: 0, purchases: 0 }],
      items,
      rules,
    );
    expect(p.perThousand).toBe(0);
    expect(p.quietWinner).toBe(false);
  });

  it("is deterministic", () => {
    expect(ingestPosts(posts, items, rules)).toEqual(out);
  });
});

describe("the two ingest modes", () => {
  // The fixture dates run from Nov 2025 to Aug 2026.
  const NOW = "2026-09-20T12:00:00.000Z";

  it("a twelve month backfill takes the posts inside the window", () => {
    const r = ingest(posts, items, rules, { mode: "backfill", months: 12, now: NOW });
    expect(r.mode).toBe("backfill");
    expect(r.window.from).toBe("2025-09-20");
    expect(r.window.to).toBe("2026-09-20");
    // Every fixture post falls inside twelve months of that date.
    expect(r.posts).toHaveLength(5);
    expect(r.posts.every((p) => p.reason === "in-window")).toBe(true);
  });

  it("a shorter backfill leaves the older posts out", () => {
    // Three months back from 20 Sep is 20 Jun, so only the July and August
    // posts survive.
    const r = ingest(posts, items, rules, { mode: "backfill", months: 3, now: NOW });
    expect(r.posts.map((p) => p.id)).toEqual(["e03-4", "e03-5"]);
  });

  it("a one month backfill leaves all but the newest out", () => {
    const r = ingest(posts, items, rules, { mode: "backfill", months: 1, now: NOW });
    expect(r.posts.map((p) => p.id)).toEqual(["e03-5"]);
  });

  it("still flags only the blazer post, whichever mode found it", () => {
    const back = ingest(posts, items, rules, { mode: "backfill", now: NOW });
    expect(back.quietWinners).toEqual(["e03-4"]);
  });

  it("a nightly run takes only what is new since the last one", () => {
    const r = ingest(posts, items, rules, {
      mode: "nightly",
      since: "2026-06-01",
      now: NOW,
    });
    expect(r.mode).toBe("nightly");
    expect(r.posts.map((p) => p.id)).toEqual(["e03-4", "e03-5"]);
    expect(r.posts.every((p) => p.reason === "new-since-last-run")).toBe(true);
  });

  it("a nightly run refreshes the last two days, because insights lag", () => {
    // Pretend the newest post went up yesterday and was already ingested.
    const recent = posts.map((p) =>
      p.id === "e03-5" ? { ...p, postedAt: "2026-09-19" } : p,
    );
    const r = ingest(recent, items, rules, {
      mode: "nightly",
      since: "2026-09-20",
      now: NOW,
    });
    expect(r.refreshed).toEqual(["e03-5"]);
    expect(r.posts).toHaveLength(1);
  });

  it("a first nightly run with no previous run takes everything dated", () => {
    const r = ingest(posts, items, rules, { mode: "nightly", since: null, now: NOW });
    expect(r.posts).toHaveLength(5);
  });

  it("never drops an undated post from a backfill", () => {
    const undated = [{ id: "x", title: "No date", views: 1000, saves: 0, purchases: 20 }];
    const r = ingest(undated, items, rules, { mode: "backfill", now: NOW });
    expect(r.posts).toHaveLength(1);
    expect(r.posts[0].quietWinner).toBe(true);
  });

  it("is deterministic when the clock is given", () => {
    const opts = { mode: "backfill" as const, now: NOW };
    expect(ingest(posts, items, rules, opts)).toEqual(
      ingest(posts, items, rules, opts),
    );
  });
});
