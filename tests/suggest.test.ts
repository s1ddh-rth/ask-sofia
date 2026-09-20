import { describe, expect, it } from "vitest";
import { loadData } from "@/lib/data/load";
import { decide } from "@/lib/engine/decide";
import { suggest, type QuestionLike } from "@/lib/suggest/heuristics";
import type { OverrideAnswer } from "@/lib/engine/types";

const data = loadData();
const { byId, rules } = data;

function rows(
  groupKey: string,
  itemId: string | null,
  count: number,
  feedback: string | null = null,
): QuestionLike[] {
  return Array.from({ length: count }, () => ({
    group_key: groupKey,
    item_id: itemId,
    feedback,
    verdict: null,
  }));
}

const herAnswer: OverrideAnswer = {
  call: "SKIP",
  reasons: ["The cut changed this season and it sits badly on the shoulder."],
};

describe("the repeated answer heuristic", () => {
  it("proposes a rule once one answer is covering enough people", () => {
    const out = suggest({
      questions: rows("black-blazer:decide", "black-blazer", 6),
      overrides: { "black-blazer:decide": herAnswer },
      byId,
      rules,
    });
    const s = out.find((x) => x.kind === "repeated-answer");
    expect(s).toBeDefined();
    expect(s?.count).toBe(6);
    expect(s?.patch?.target).toBe("black-blazer");
  });

  it("stays quiet below her threshold", () => {
    const out = suggest({
      questions: rows("black-blazer:decide", "black-blazer", 2),
      overrides: { "black-blazer:decide": herAnswer },
      byId,
      rules,
    });
    expect(out.filter((x) => x.kind === "repeated-answer")).toHaveLength(0);
  });

  it("stays quiet when she has not answered at all", () => {
    const out = suggest({
      questions: rows("black-blazer:decide", "black-blazer", 9),
      overrides: {},
      byId,
      rules,
    });
    expect(out).toHaveLength(0);
  });

  it("proposes a patch that actually produces her answer", () => {
    const out = suggest({
      questions: rows("black-blazer:decide", "black-blazer", 4),
      overrides: { "black-blazer:decide": herAnswer },
      byId,
      rules,
    });
    const patch = out[0].patch!;
    // Approving it and dropping the override still gives her call.
    const patched = loadData({ patches: [patch] });
    const v = decide({
      item: patched.byId["black-blazer"],
      context: { owns: [], wear: "weekly" },
      rules: patched.rules,
      copy: patched.copy,
      byId: patched.byId,
    });
    expect(v.call).toBe("SKIP");
    expect(v.reasons.join(" ")).toContain("sits badly");
  });
});

describe("the thumbs down heuristic", () => {
  it("sends a verdict to review once enough people say it is not useful", () => {
    const out = suggest({
      questions: rows("grey-knit:should-buy", "grey-knit", 2, "down"),
      overrides: {},
      byId,
      rules,
    });
    const s = out.find((x) => x.kind === "needs-review");
    expect(s).toBeDefined();
    expect(s?.count).toBe(2);
    // It deliberately proposes nothing, because we do not know what is wrong.
    expect(s?.patch).toBeNull();
  });

  it("ignores a single thumbs down", () => {
    const out = suggest({
      questions: rows("grey-knit:should-buy", "grey-knit", 1, "down"),
      overrides: {},
      byId,
      rules,
    });
    expect(out).toHaveLength(0);
  });

  it("puts a review above a proposal", () => {
    const out = suggest({
      questions: [
        ...rows("black-blazer:decide", "black-blazer", 6),
        ...rows("grey-knit:should-buy", "grey-knit", 2, "down"),
      ],
      overrides: { "black-blazer:decide": herAnswer },
      byId,
      rules,
    });
    expect(out[0].kind).toBe("needs-review");
  });
});

describe("suggestions are pure", () => {
  it("gives the same suggestions for the same logs", () => {
    const input = {
      questions: rows("loafers:decide", "loafers", 5),
      overrides: { "loafers:decide": herAnswer },
      byId,
      rules,
    };
    expect(suggest(input)).toEqual(suggest(input));
  });
});
