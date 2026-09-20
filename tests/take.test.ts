import { describe, expect, it } from "vitest";
import { loadData } from "@/lib/data/load";
import { decide } from "@/lib/engine/decide";
import { takeLabel } from "@/lib/engine/take";
import type { UserContext } from "@/lib/engine/types";

const data = loadData();

// Every shape of context the taps can produce.
const CONTEXTS: UserContext[] = [];
for (const wear of [undefined, "weekly", "few", "occasional"] as const) {
  for (const occasion of [undefined, true] as const) {
    for (const budgetGBP of [undefined, 50, 250] as const) {
      CONTEXTS.push({ owns: [], wear, occasion, budgetGBP });
    }
  }
}

function callsFor(id: string) {
  return new Set(
    CONTEXTS.map(
      (context) =>
        decide({
          item: data.byId[id],
          context,
          rules: data.rules,
          copy: data.copy,
          byId: data.byId,
        }).call,
    ),
  );
}

describe("her take never contradicts the verdict", () => {
  for (const item of data.items) {
    it(`${item.id} reads honestly`, () => {
      const calls = callsFor(item.id);
      const label = takeLabel(item, data.copy);

      // A piece that can only ever be skipped must say so on the card.
      if (calls.size === 1 && calls.has("SKIP")) {
        expect(
          label,
          `${item.id} always returns SKIP but its take reads "${label}"`,
        ).toBe(data.copy.takeLabels.avoid);
      }

      // And a piece that can be bought must not read as one she would skip.
      if (calls.has("BUY")) {
        expect(
          label,
          `${item.id} can return BUY but its take reads "${label}"`,
        ).not.toBe(data.copy.takeLabels.avoid);
      }
    });
  }

  it("the grey knit is the case this exists for", () => {
    const knit = data.byId["grey-knit"];
    expect(knit.verdictType).toBe("investment");
    expect(knit.caveat?.severity).toBe("hard");
    expect(callsFor("grey-knit")).toEqual(new Set(["SKIP"]));
    expect(takeLabel(knit, data.copy)).toBe("Sofia would skip it");
  });
});
