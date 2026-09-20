import { describe, expect, it } from "vitest";
import { loadData } from "@/lib/data/load";
import { decide } from "@/lib/engine/decide";
import type { UserContext } from "@/lib/engine/types";

const data = loadData();

// Every combination the taps can produce.
const CONTEXTS: Array<{ label: string; context: UserContext }> = [];
for (const wear of [undefined, "weekly", "few", "occasional"] as const) {
  for (const occasion of [undefined, true] as const) {
    for (const budgetGBP of [undefined, 50, 250] as const) {
      CONTEXTS.push({
        label: `wear=${wear ?? "-"} occasion=${occasion ?? "-"} budget=${budgetGBP ?? "-"}`,
        context: { owns: [], wear, occasion, budgetGBP },
      });
    }
  }
}

function callsFor(id: string) {
  return CONTEXTS.map(({ context }) =>
    decide({
      item: data.byId[id],
      context,
      rules: data.rules,
      copy: data.copy,
      byId: data.byId,
    }).call,
  );
}

describe("what her followers can and cannot move", () => {
  it("prints which pieces respond to the taps", () => {
    const rows = data.items.map((item) => {
      const calls = callsFor(item.id);
      const distinct = [...new Set(calls)].sort();
      return { id: item.id, type: item.verdictType, distinct };
    });
    const lines = rows.map(
      (r) =>
        `  ${r.id.padEnd(17)} ${r.type.padEnd(12)} ${
          r.distinct.length === 1 ? "FIXED  " : "MOVES  "
        } ${r.distinct.join(" / ")}`,
    );
    process.stdout.write(
      `\n  Which pieces the follower's answers can move\n${lines.join("\n")}\n\n`,
    );
    expect(rows.length).toBe(8);
  });

  // The line that matters. Her instinct is never overturned by a tap.
  it("never lets a tap overturn a hard caveat", () => {
    expect(new Set(callsFor("grey-knit"))).toEqual(new Set(["SKIP"]));
  });

  it("never lets a tap overturn out of stock", () => {
    const gone = { ...data.byId["black-blazer"], stock: "out" as const };
    const calls = CONTEXTS.map(
      ({ context }) =>
        decide({
          item: gone,
          context,
          rules: data.rules,
          copy: data.copy,
          byId: data.byId,
        }).call,
    );
    expect(new Set(calls)).toEqual(new Set(["WAIT"]));
  });

  it("never lets a tap overturn her confirmed answer", () => {
    const answer = { call: "SKIP" as const, reasons: ["Not this season."] };
    const calls = CONTEXTS.map(
      ({ context }) =>
        decide({
          item: data.byId["black-blazer"],
          context,
          rules: data.rules,
          copy: data.copy,
          byId: data.byId,
          override: answer,
        }).call,
    );
    expect(new Set(calls)).toEqual(new Set(["SKIP"]));
  });

  // And the ones she left conditional do move, which is the whole product.
  it("lets how often you would wear it move an investment piece", () => {
    const weekly = decide({
      item: data.byId["black-blazer"],
      context: { owns: [], wear: "weekly" },
      rules: data.rules,
      copy: data.copy,
      byId: data.byId,
    });
    const rarely = decide({
      item: data.byId["black-blazer"],
      context: { owns: [], wear: "occasional" },
      rules: data.rules,
      copy: data.copy,
      byId: data.byId,
    });
    expect(weekly.call).toBe("BUY");
    expect(rarely.call).toBe("WAIT");
    expect(weekly.costPerWear).toBeCloseTo(3.02, 2);
    expect(rarely.costPerWear).toBeCloseTo(24.17, 2);
  });

  it("lets having somewhere to be move a statement piece", () => {
    const without = decide({
      item: data.byId["red-slingback"],
      context: { owns: [] },
      rules: data.rules,
      copy: data.copy,
      byId: data.byId,
    });
    const with_ = decide({
      item: data.byId["red-slingback"],
      context: { owns: [], occasion: true },
      rules: data.rules,
      copy: data.copy,
      byId: data.byId,
    });
    expect(without.call).toBe("WAIT");
    expect(with_.call).toBe("BUY");
  });
});
