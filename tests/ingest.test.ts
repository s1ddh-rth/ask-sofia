import { describe, expect, it } from "vitest";
import posts from "@/data/posts.json";
import { loadData } from "@/lib/data/load";
import { ingestPosts } from "@/lib/ingest/posts";

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
