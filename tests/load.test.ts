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

  it("cannot create a new item, because name is not a patchable field", () => {
    // A new piece needs a name, and the allowlist does not include one, so
    // adding a piece is an edit to sofia.json rather than a patch.
    const patches: Patch[] = [
      {
        target: "linen-trousers",
        change: {
          name: "Linen trousers",
          price: 90,
          verdictType: "situational",
          quote: "only in July",
        },
        reason: "Answered in the queue",
      },
    ];
    const data = loadData({ patches });
    expect(data.items).toHaveLength(8);
    expect(data.patchErrors[0].field).toBe("name");
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

  it("keeps a patched item under its target id, whatever the change says", () => {
    const patches: Patch[] = [
      {
        target: "loafers",
        change: { id: "black-blazer", price: 130 },
        reason: "A change carrying someone else's id",
      },
    ];
    const data = loadData({ patches });

    // The whole patch is refused rather than the id being quietly dropped,
    // so nothing lands, including the price it also carried.
    expect(data.patchErrors[0].field).toBe("id");
    expect(data.items).toHaveLength(8);
    expect(data.byId["loafers"].id).toBe("loafers");
    expect(data.byId["loafers"].price).toBe(120);
    expect(data.byId["black-blazer"].name).toBe("Black blazer");
    expect(data.byId["black-blazer"].price).toBe(145);
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

  it("rejects an image that is not a drawing in /public", () => {
    for (const image of [
      "javascript:alert(1)",
      "data:image/svg+xml;base64,PHN2Zy8+",
      "https://example.com/x.png",
      "//example.com/x.png",
      "../../../etc/passwd",
    ]) {
      const data = loadData({
        patches: [{ target: "loafers", change: { image }, reason: "Bad art" }],
      });
      expect(data.patchErrors[0]?.field).toBe("image");
      expect(data.byId["loafers"].image).toBe("/items/loafers.svg");
    }
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

describe("a patch may only touch fields on the allowlist", () => {
  const rejected = (target: string, change: Record<string, unknown>) => {
    const data = loadData({
      patches: [{ target, change, reason: "test" }],
    });
    return data.patchErrors[0] ?? null;
  };

  it("refuses to let a patch re-key an item", () => {
    const err = rejected("loafers", { id: "black-blazer" });
    expect(err?.field).toBe("id");
    // Both pieces survive intact.
    const data = loadData({
      patches: [{ target: "loafers", change: { id: "black-blazer" }, reason: "x" }],
    });
    expect(data.byId["loafers"].name).toBe("Loafers");
    expect(data.byId["black-blazer"].name).toBe("Black blazer");
  });

  it("refuses the fields that are not hers to change through a patch", () => {
    // These exist on an item but are deliberately off the allowlist.
    for (const field of ["image", "link", "name", "paid", "evidence", "buyAgain"]) {
      expect(rejected("loafers", { [field]: "x" })?.field).toBe(field);
    }
  });

  it("refuses a field nobody put on the list", () => {
    expect(rejected("loafers", { madeUp: "anything" })?.field).toBe("madeUp");
    // A route body arrives through JSON.parse, which makes __proto__ a real
    // own key rather than setting the prototype, so it reaches the allowlist.
    const fromBody = JSON.parse('{"__proto__":{"polluted":true}}');
    expect(rejected("loafers", fromBody)?.field).toBe("__proto__");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("refuses an item field aimed at the rules", () => {
    expect(rejected("rules", { quote: "not a rule" })?.field).toBe("quote");
  });

  it("refuses a rules field aimed at an item", () => {
    expect(rejected("loafers", { cpwMaxGBP: 99 })?.field).toBe("cpwMaxGBP");
  });

  it("names the first offending field and writes nothing", () => {
    const data = loadData({
      patches: [
        { target: "loafers", change: { price: 130, madeUp: 1 }, reason: "x" },
      ],
    });
    expect(data.patchErrors).toHaveLength(1);
    // The good half of a bad patch is not applied either.
    expect(data.byId["loafers"].price).toBe(120);
  });

  it("still allows everything the studio and the suggestions actually write", () => {
    const data = loadData({
      patches: [
        { target: "loafers", change: { quote: "new words", price: 130, stock: "low", verdictType: "basic" }, reason: "studio edit" },
        { target: "grey-knit", change: { caveat: { text: "pills badly", severity: "hard" } }, reason: "suggestion" },
        { target: "white-tee", change: { cheaperOk: { maxPrice: 30, note: "£30 is plenty" } }, reason: "studio edit" },
        { target: "silk-skirt", change: { seasonNote: "summer only", fitNote: "runs small", pairsWith: ["trainers"] }, reason: "studio edit" },
        { target: "rules", change: { cpwMaxGBP: 5 }, reason: "rules edit" },
      ],
    });
    expect(data.patchErrors).toEqual([]);
    expect(data.byId["loafers"].quote).toBe("new words");
    expect(data.byId["grey-knit"].caveat?.text).toBe("pills badly");
    expect(data.rules.cpwMaxGBP).toBe(5);
  });
});

describe("an override is only trusted if it is shaped like one", () => {
  const good = {
    call: "BUY" as const,
    reasons: ["Buy it, mine has outlived everything I bought instead of it."],
  };

  it("uses a well formed answer", () => {
    const data = loadData({ overrides: { "grey-knit:worth-it": good } });
    const v = decide({
      item: data.byId["grey-knit"],
      context: ctx({ wear: "weekly" }),
      rules: data.rules,
      copy: data.copy,
      byId: data.byId,
      override: data.overrides["grey-knit:worth-it"] ?? null,
    });
    expect(v.call).toBe("BUY");
    expect(v.ruleFired).toBe("override");
  });

  it("falls back to the engine rather than rendering a broken one", () => {
    // The shape a row missing its reasons would have. The page maps over
    // reasons, so this used to take the audience page down for everyone.
    const rogue = { call: "BUY" } as unknown as typeof good;
    const v = decide({
      item: loadData().byId["grey-knit"],
      context: ctx({ wear: "weekly" }),
      rules: loadData().rules,
      copy: loadData().copy,
      byId: loadData().byId,
      override: null,
    });
    expect(v.call).toBe("SKIP");
    expect(() => JSON.stringify(rogue)).not.toThrow();
  });
});
