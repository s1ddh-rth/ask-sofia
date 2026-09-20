import { describe, expect, it } from "vitest";
import { loadData } from "@/lib/data/load";
import { decide } from "@/lib/engine/decide";
import type { Patch, UserContext } from "@/lib/engine/types";

const ctx = (over: Partial<UserContext> = {}): UserContext => ({
  owns: [],
  ...over,
});

function verdictFor(id: string, patches: Patch[] = [], context = ctx()) {
  const data = loadData({ patches });
  return {
    data,
    verdict: decide({
      item: data.byId[id] ?? null,
      context,
      rules: data.rules,
      copy: data.copy,
      byId: data.byId,
    }),
  };
}

describe("loadData", () => {
  it("loads her eight items and validates the rules", () => {
    const data = loadData();
    expect(data.items).toHaveLength(8);
    expect(data.byId["black-blazer"].price).toBe(145);
    expect(data.rules.basicCapGBP).toBe(35);
    expect(data.patchErrors).toEqual([]);
  });

  it("fills the optional fields so nothing downstream has to guess", () => {
    const base = loadData();
    const data = loadData({
      source: {
        rules: base.rules,
        ownedTags: base.ownedTags,
        copy: base.copy,
        items: [
          {
            id: "linen-trousers",
            name: "Linen trousers",
            price: 90,
            verdictType: "situational",
            quote: "only in July",
          },
        ],
      },
    });
    const item = data.byId["linen-trousers"];
    expect(item.stock).toBe("in");
    expect(item.paid).toBe(false);
    expect(item.pairsWith).toEqual([]);
    expect(item.buyAgain).toBeNull();
    expect(item.evidence).toEqual([]);
  });

  it("keeps unknown fields untouched", () => {
    const base = loadData();
    const data = loadData({
      source: {
        rules: base.rules,
        ownedTags: base.ownedTags,
        copy: base.copy,
        items: [
          {
            id: "mystery",
            name: "Mystery",
            price: 10,
            verdictType: "basic",
            quote: "who knows",
            madeUpField: "still here",
          },
        ],
      },
    });
    expect(data.byId["mystery"].madeUpField).toBe("still here");
  });
});

describe("patches", () => {
  it("changes the verdict it should", () => {
    const before = verdictFor("black-blazer", [], ctx({ wear: "weekly" }));
    expect(before.verdict.call).toBe("BUY");

    // She reprices it well past what a year of weekly wear can justify.
    const patch: Patch = {
      target: "black-blazer",
      change: { price: 900 },
      reason: "Price went up at the shop",
    };
    const after = verdictFor("black-blazer", [patch], ctx({ wear: "weekly" }));
    expect(after.verdict.call).toBe("WAIT");
    expect(after.data.byId["black-blazer"].price).toBe(900);
  });

  it("applies in order, so the last patch on a field wins", () => {
    const patches: Patch[] = [
      { target: "white-tee", change: { price: 50 }, reason: "first" },
      { target: "white-tee", change: { price: 60 }, reason: "second" },
    ];
    const data = loadData({ patches });
    expect(data.byId["white-tee"].price).toBe(60);
  });

  it("can patch the rules themselves", () => {
    const patches: Patch[] = [
      { target: "rules", change: { cpwMaxGBP: 2 }, reason: "Stricter line" },
    ];
    const data = loadData({ patches });
    expect(data.rules.cpwMaxGBP).toBe(2);
    // The blazer at £3.02 a wear no longer clears a £2 line.
    const v = decide({
      item: data.byId["black-blazer"],
      context: ctx({ wear: "weekly" }),
      rules: data.rules,
      copy: data.copy,
      byId: data.byId,
    });
    expect(v.call).toBe("WAIT");
  });

  it("can add a new item she has just written about", () => {
    const patches: Patch[] = [
      {
        target: "linen-trousers",
        change: {
          name: "Linen trousers",
          price: 90,
          verdictType: "situational",
          quote: "only in July",
          seasonNote: "only in July",
        },
        reason: "Answered in the queue",
      },
    ];
    const data = loadData({ patches });
    expect(data.items).toHaveLength(9);
    expect(data.byId["linen-trousers"].name).toBe("Linen trousers");
    expect(data.patchErrors).toEqual([]);
  });

  it("rejects an invalid patch and leaves the previous state live", () => {
    const patches: Patch[] = [
      {
        target: "black-blazer",
        change: { price: "not a number" },
        reason: "Typo in the studio",
      },
    ];
    const data = loadData({ patches });

    expect(data.patchErrors).toHaveLength(1);
    expect(data.patchErrors[0].target).toBe("black-blazer");
    expect(data.patchErrors[0].field).toBe("price");
    expect(data.patchErrors[0].message).toContain("black-blazer");
    expect(data.patchErrors[0].message).toContain("price");

    // Previous state stays live.
    expect(data.byId["black-blazer"].price).toBe(145);
    const v = decide({
      item: data.byId["black-blazer"],
      context: ctx({ wear: "weekly" }),
      rules: data.rules,
      copy: data.copy,
      byId: data.byId,
    });
    expect(v.call).toBe("BUY");
  });

  it("rejects a new item that is missing required fields", () => {
    const patches: Patch[] = [
      { target: "half-item", change: { name: "Half an item" }, reason: "Oops" },
    ];
    const data = loadData({ patches });
    expect(data.items).toHaveLength(8);
    expect(data.patchErrors[0].target).toBe("half-item");
  });

  it("rejects an invalid rules patch and keeps the old rules", () => {
    const patches: Patch[] = [
      { target: "rules", change: { cpwMaxGBP: -5 }, reason: "Nonsense" },
    ];
    const data = loadData({ patches });
    expect(data.rules.cpwMaxGBP).toBe(4);
    expect(data.patchErrors[0].target).toBe("rules");
    expect(data.patchErrors[0].field).toBe("cpwMaxGBP");
  });

  it("rejects one bad patch without losing the good ones around it", () => {
    const patches: Patch[] = [
      { target: "white-tee", change: { price: 20 }, reason: "good" },
      { target: "white-tee", change: { price: "nope" }, reason: "bad" },
      { target: "loafers", change: { price: 130 }, reason: "good" },
    ];
    const data = loadData({ patches });
    expect(data.byId["white-tee"].price).toBe(20);
    expect(data.byId["loafers"].price).toBe(130);
    expect(data.patchErrors).toHaveLength(1);
  });
});

describe("merge order", () => {
  it("puts overrides above patches", () => {
    // A patch says the blazer is a clear buy at weekly wear.
    const patches: Patch[] = [
      { target: "black-blazer", change: { price: 40 }, reason: "Sale" },
    ];
    const patched = loadData({ patches });
    const withoutOverride = decide({
      item: patched.byId["black-blazer"],
      context: ctx({ wear: "weekly" }),
      rules: patched.rules,
      copy: patched.copy,
      byId: patched.byId,
    });
    expect(withoutOverride.call).toBe("BUY");

    // Sofia's confirmed answer wins anyway.
    const answer = {
      call: "SKIP" as const,
      reasons: ["She says the sale version is the old cut and it fits badly."],
    };
    const withOverride = decide({
      item: patched.byId["black-blazer"],
      context: ctx({ wear: "weekly" }),
      rules: patched.rules,
      copy: patched.copy,
      byId: patched.byId,
      override: answer,
    });
    expect(withOverride.call).toBe("SKIP");
    expect(withOverride.ruleFired).toBe("override");
    expect(withOverride.reasons).toEqual(answer.reasons);
  });
});
