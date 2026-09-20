import { describe, expect, it } from "vitest";
import { loadData } from "@/lib/data/load";
import { decide } from "@/lib/engine/decide";
import type { Item, Job, UserContext } from "@/lib/engine/types";

const data = loadData();
const { rules, copy, byId } = data;

function ask(item: Item | null, context: Partial<UserContext> = {}, override = null) {
  return decide({
    item,
    context: { owns: [], ...context },
    rules,
    copy,
    byId,
    override,
  });
}

describe("decide", () => {
  it("gives BUY on a blazer worn weekly", () => {
    const v = ask(byId["black-blazer"], { wear: "weekly" });
    expect(v.call).toBe("BUY");
    // 145 over 4 wears a month for 12 months is about £3.02, under her £4 line.
    expect(v.costPerWear).toBeCloseTo(3.02, 2);
    expect(v.confident).toBe(true);
  });

  it("gives WAIT on a blazer worn only now and then", () => {
    const v = ask(byId["black-blazer"], { wear: "occasional" });
    expect(v.call).toBe("WAIT");
    expect(v.costPerWear).toBeCloseTo(24.17, 2);
  });

  it("gives SKIP on the grey knit and says soft but pills", () => {
    const v = ask(byId["grey-knit"], { wear: "weekly" });
    expect(v.call).toBe("SKIP");
    expect(v.reasons.join(" ")).toContain("soft but pills");
  });

  it("points a £60 white tee at the £35 version", () => {
    const pricey = { ...byId["white-tee"], price: 60 };
    const v = ask(pricey, { wear: "weekly" });
    expect(v.call).toBe("WAIT");
    expect(v.alternative).toContain("35");
    expect(v.reasons.join(" ")).toContain("£35");
  });

  it("leaves a £35 white tee alone", () => {
    const v = ask(byId["white-tee"], { wear: "weekly" });
    expect(v.call).toBe("BUY");
  });

  it("gives WAIT on the red slingback with no occasion", () => {
    const v = ask(byId["red-slingback"]);
    expect(v.call).toBe("WAIT");
    expect(v.ruleFired).toBe("statement-no-occasion");
  });

  it("gives BUY on the red slingback when there is an occasion", () => {
    const v = ask(byId["red-slingback"], { occasion: true });
    expect(v.call).toBe("BUY");
  });

  it("gives WAIT on an out of stock item", () => {
    const gone = { ...byId["black-blazer"], stock: "out" as const };
    const v = ask(gone, { wear: "weekly" });
    expect(v.call).toBe("WAIT");
    expect(v.ruleFired).toBe("stock-out");
  });

  it("gives ESCALATE on an unknown item", () => {
    const v = ask(null, { wear: "weekly" });
    expect(v.call).toBe("ESCALATE");
    expect(v.confident).toBe(false);
  });

  it("gives ESCALATE when an investment has no wear to go on", () => {
    const v = ask(byId["black-blazer"]);
    expect(v.call).toBe("ESCALATE");
    expect(v.confident).toBe(false);
  });

  it("returns Sofia's answer when an override is confirmed", () => {
    const override = {
      call: "SKIP" as const,
      reasons: ["Sofia says wait for the sale, it always goes down in January."],
    };
    const v = ask(byId["black-blazer"], { wear: "weekly" }, override as never);
    expect(v.call).toBe("SKIP");
    expect(v.ruleFired).toBe("override");
    expect(v.reasons).toEqual(override.reasons);
  });

  it("gives a paid item the same verdict as an identical unpaid one", () => {
    const unpaid = { ...byId["black-blazer"], paid: false };
    const paid = { ...byId["black-blazer"], paid: true };
    const a = ask(unpaid, { wear: "weekly" });
    const b = ask(paid, { wear: "weekly" });
    expect(b.call).toBe(a.call);
    expect(b.ruleFired).toBe(a.ruleFired);
    expect(b.costPerWear).toBe(a.costPerWear);
    expect(b.reasons).toEqual(a.reasons);
    // The only difference is the disclosure.
    expect(a.paidDisclosure).toBeFalsy();
    expect(b.paidDisclosure).toBe(true);
  });

  it("caps pairings at her limit and only uses what you own", () => {
    const v = ask(byId["black-blazer"], {
      wear: "weekly",
      owns: ["white-tee", "loafers", "boots"],
    });
    expect(v.pairings.length).toBeLessThanOrEqual(rules.maxPairings);
    expect(v.pairings).toContain("white-tee");
    expect(v.pairings).not.toContain("boots");
  });

  it("is deterministic, the same input gives the same output", () => {
    const once = ask(byId["loafers"], { wear: "few", owns: ["wide-leg-denim"] });
    const twice = ask(byId["loafers"], { wear: "few", owns: ["wide-leg-denim"] });
    expect(twice).toEqual(once);
  });
});

describe("the card explains itself", () => {
  const data = loadData();
  const say = (id: string, context: Partial<UserContext> = {}) =>
    decide({
      item: data.byId[id],
      context: { owns: [], ...context },
      rules: data.rules,
      copy: data.copy,
      byId: data.byId,
    });

  it("tells the slingback buyer why having somewhere to be matters", () => {
    const v = say("red-slingback", { occasion: true });
    expect(v.call).toBe("BUY");
    expect(v.reasons.length).toBeGreaterThan(1);
    expect(v.reasons.join(" ").toLowerCase()).toContain("somewhere to be");
  });

  it("says why a basic within her cap is fine", () => {
    const v = say("white-tee", { wear: "weekly" });
    expect(v.call).toBe("BUY");
    expect(v.reasons.join(" ")).toContain("35");
  });

  it("never leaves a verdict standing on the quote alone", () => {
    for (const item of data.items) {
      for (const context of [
        { owns: [] },
        { owns: [], wear: "weekly" as const },
        { owns: [], occasion: true },
        { owns: [], wear: "occasional" as const, budgetGBP: 50 },
      ]) {
        const v = decide({
          item,
          context,
          rules: data.rules,
          copy: data.copy,
          byId: data.byId,
        });
        expect(
          v.reasons.length,
          `${item.id} gave only one reason for ${JSON.stringify(context)}`,
        ).toBeGreaterThan(1);
      }
    }
  });
});

describe("it answers the question that was asked", () => {
  const data = loadData();
  const askJob = (id: string, job: Job) =>
    decide({
      item: data.byId[id],
      context: { owns: [] },
      rules: data.rules,
      copy: data.copy,
      byId: data.byId,
      job,
    });

  // The bug this exists for. An investment piece used to demand how often you
  // would wear it before it would say anything at all, so every question that
  // was not about buying went to her queue for no reason.
  it("does not send a where question to her queue", () => {
    const v = askJob("loafers", "where");
    expect(v.call).not.toBe("ESCALATE");
    expect(v.ruleFired).not.toBe("escalate-missing-wear");
  });

  it("answers a size question from her data", () => {
    const v = askJob("loafers", "size");
    expect(v.call).not.toBe("ESCALATE");
    expect(v.reasons[0]).toContain("UK 5");
  });

  it("answers a pairing question from what she pairs it with", () => {
    const v = askJob("loafers", "pairing");
    expect(v.call).not.toBe("ESCALATE");
    expect(v.reasons[0].toLowerCase()).toContain("wide-leg denim".toLowerCase());
  });

  it("leads with what they already own when they own it", () => {
    const v = decide({
      item: data.byId["loafers"],
      context: { owns: ["wide-leg-denim"] },
      rules: data.rules,
      copy: data.copy,
      byId: data.byId,
      job: "pairing",
    });
    expect(v.reasons[0]).toContain("already own");
  });

  it("answers a cheaper question from her own alternative", () => {
    const v = askJob("white-tee", "cheaper");
    expect(v.reasons[0]).toContain("£35");
  });

  it("says so plainly when she has no cheaper version", () => {
    const v = askJob("loafers", "cheaper");
    expect(v.reasons[0].toLowerCase()).toContain("no cheaper version");
  });

  // And the buy shaped questions still escalate without it, because there
  // the wear really is the whole argument.
  it("still escalates a buy question with no wear given", () => {
    for (const job of ["worth-it", "decide", "should-buy"] as Job[]) {
      const v = askJob("loafers", job);
      expect(v.call, `${job} should still escalate`).toBe("ESCALATE");
      expect(v.ruleFired).toBe("escalate-missing-wear");
    }
  });

  // Her instinct still outranks all of it.
  it("still skips the grey knit whatever is asked", () => {
    for (const job of ["where", "size", "pairing", "cheaper"] as Job[]) {
      expect(askJob("grey-knit", job).call, job).toBe("SKIP");
    }
  });
});
