import { describe, expect, it } from "vitest";
import dms from "@/evals/dms.json";
import { loadData } from "@/lib/data/load";
import { parseFallback } from "@/lib/parse/fallback";

const { items, ownedTags } = loadData();

describe("parseFallback over the E-01 DMs", () => {
  for (const dm of dms) {
    it(`#${dm.id} reads as ${dm.job}`, () => {
      const parsed = parseFallback(dm.text, items, ownedTags);
      expect(parsed.job).toBe(dm.job);
      expect(parsed.itemId).toBe(dm.itemId);
      if ("budgetGBP" in dm) expect(parsed.budgetGBP).toBe(dm.budgetGBP);
      if ("owns" in dm) expect(parsed.owns).toEqual(dm.owns);
      if ("occasion" in dm) expect(parsed.occasion).toBe(dm.occasion);
    });
  }
});
