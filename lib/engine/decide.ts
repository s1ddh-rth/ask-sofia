// The only thing in this app that decides a verdict. Pure, no I/O, no model.
// Same input, same output, every time.

import type {
  Copy,
  Item,
  Job,
  OverrideAnswer,
  Rules,
  UserContext,
  Verdict,
} from "./types";

// Questions that are not buy decisions. Asking where a piece is from, what
// size she takes, what she wears it with or whether there is a cheaper one
// can all be answered from her data without knowing how often you would wear
// it, so these must not be sent to her queue for want of that.
const INFORMATIONAL: Job[] = ["where", "size", "pairing", "cheaper"];

type DecideInput = {
  item: Item | null;
  context: UserContext;
  rules: Rules;
  copy: Copy;
  byId?: Record<string, Item>;
  override?: OverrideAnswer | null;
  job?: Job;
};

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] === undefined ? "" : String(vars[key]),
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Rule 9. The intersection of what she pairs it with and what you own,
// capped at the number of things she is willing to name.
function pairingsFor(
  item: Item | null,
  context: UserContext,
  rules: Rules,
): string[] {
  if (!item) return [];
  const owns = new Set(context.owns ?? []);
  return item.pairsWith.filter((p) => owns.has(p)).slice(0, rules.maxPairings);
}

function readable(
  pairings: string[],
  byId: Record<string, Item> | undefined,
): string {
  const names = pairings.map((p) => byId?.[p]?.name ?? p);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function decide({
  item,
  context,
  rules,
  copy,
  byId,
  override,
  job,
}: DecideInput): Verdict {
  const R = copy.reasons;
  const pairings = pairingsFor(item, context, rules);

  // Rule 1. Sofia has already answered this group, so that is the answer.
  if (override) {
    return {
      call: override.call,
      ruleFired: "override",
      reasons: override.reasons,
      pairings,
      ...(override.alternative ? { alternative: override.alternative } : {}),
      ...(override.caveat ? { caveat: override.caveat } : {}),
      ...(item?.paid ? { paidDisclosure: true } : {}),
      confident: true,
    };
  }

  // Rule 10. She has not talked about this one, so it goes to her queue.
  if (!item) {
    return {
      call: "ESCALATE",
      ruleFired: "escalate-unknown-item",
      reasons: [R.escalateUnknown],
      pairings: [],
      confident: false,
    };
  }

  const quote = fill(R.quote, { quote: item.quote });
  const asking = job && INFORMATIONAL.includes(job) ? job : null;

  // What they asked for, answered from her data rather than inferred.
  const answerTo = (): string[] => {
    if (asking === "where") {
      return [item.link ? R.whereLink : R.whereNoLink];
    }
    if (asking === "size") {
      const lines = item.size
        ? [fill(R.sizeIs, { size: item.size })]
        : [R.sizeUnknown];
      if (item.fitNote) lines.push(fill(R.sizeFit, { fitNote: item.fitNote }));
      return lines;
    }
    if (asking === "pairing") {
      if (pairings.length > 0) {
        return [fill(R.pairingOwned, { pairings: readable(pairings, byId) })];
      }
      if (item.pairsWith.length > 0) {
        return [
          fill(R.pairingHers, {
            pairings: readable(item.pairsWith.slice(0, rules.maxPairings), byId),
          }),
        ];
      }
      return [R.pairingNone];
    }
    if (asking === "cheaper") {
      return item.cheaperOk
        ? [fill(R.cheaperYes, { note: item.cheaperOk.note })]
        : [R.cheaperNo];
    }
    return [];
  };
  // Paid status is attached after the fact and is never read by a rule.
  const disclosure = item.paid ? { paidDisclosure: true } : {};
  const pairingReason =
    pairings.length > 0
      ? [fill(R.pairings, { pairings: readable(pairings, byId) })]
      : [];

  const settle = (
    call: Verdict["call"],
    ruleFired: string,
    reasons: string[],
    extra: Partial<Verdict> = {},
  ): Verdict => ({
    call,
    ruleFired,
    // What they asked for comes first. The verdict is still the verdict, but
    // a size question should not open with cost per wear.
    reasons: [...answerTo(), ...reasons, ...(asking === "pairing" ? [] : pairingReason)],
    pairings,
    ...extra,
    ...disclosure,
    confident: true,
  });

  // Rule 2. Nothing to decide if she cannot get it either.
  if (item.stock === "out") {
    const alternative = item.cheaperOk?.note;
    return settle(
      "WAIT",
      "stock-out",
      [
        quote,
        R.stockOut,
        ...(alternative ? [fill(R.stockOutAlternative, { alternative })] : []),
      ],
      alternative ? { alternative } : {},
    );
  }

  // Rule 3. Her own words rule it out.
  if (item.verdictType === "avoid") {
    return settle("SKIP", "avoid", [quote, R.avoid]);
  }
  if (item.caveat?.severity === "hard") {
    return settle(
      "SKIP",
      "hard-caveat",
      [quote, fill(R.hardCaveat, { caveat: item.caveat.text })],
      { caveat: item.caveat.text },
    );
  }

  // Rule 4. A basic over her cap points at the cheaper one.
  if (item.verdictType === "basic" && item.price > rules.basicCapGBP) {
    const note = item.cheaperOk?.note ?? "";
    const alternative = item.cheaperOk
      ? `${item.cheaperOk.note} (£${item.cheaperOk.maxPrice})`
      : undefined;
    return settle(
      "WAIT",
      "basic-over-cap",
      [
        quote,
        fill(R.basicOverCap, { cap: rules.basicCapGBP }),
        ...(note ? [fill(R.cheaperPointer, { note })] : []),
      ],
      alternative ? { alternative } : {},
    );
  }

  // Rule 5. An investment has to earn its cost per wear.
  if (item.verdictType === "investment" && !asking) {
    if (!context.wear) {
      return {
        call: "ESCALATE",
        ruleFired: "escalate-missing-wear",
        reasons: [quote, R.escalateMissingWear],
        pairings,
        ...disclosure,
        confident: false,
      };
    }
    const wears = rules.wearsPerMonth[context.wear] * rules.cpwMonths;
    const costPerWear = round2(item.price / wears);
    const phrases = (copy.ui.wearPhrases ?? {}) as Record<string, string>;
    const vars = {
      wearLabel: phrases[context.wear] ?? context.wear,
      wears: round2(wears),
      months: rules.cpwMonths,
      cpw: costPerWear.toFixed(2),
      max: rules.cpwMaxGBP,
    };
    if (costPerWear <= rules.cpwMaxGBP) {
      return settle(
        "BUY",
        "investment-cpw",
        [
          quote,
          fill(R.cpwGood, vars),
          ...(item.buyAgain === true ? [R.buyAgainTrue] : []),
        ],
        { costPerWear },
      );
    }
    return settle("WAIT", "investment-cpw", [quote, fill(R.cpwBad, vars)], {
      costPerWear,
    });
  }

  // Rule 6. A statement piece needs somewhere to go.
  if (item.verdictType === "statement" && context.occasion !== true) {
    return settle("WAIT", "statement-no-occasion", [
      quote,
      R.statementNoOccasion,
    ]);
  }

  // Rule 7. A situational piece waits unless the context fits.
  if (item.verdictType === "situational" && context.occasion !== true) {
    const seasonNote = item.seasonNote ?? "";
    return settle(
      "WAIT",
      "situational-no-fit",
      [quote, ...(seasonNote ? [fill(R.situationalNoFit, { seasonNote })] : [])],
      seasonNote ? { caveat: seasonNote } : {},
    );
  }

  // Rule 8. Past her budget, point at the cheaper version or wait.
  if (context.budgetGBP !== undefined && item.price > context.budgetGBP) {
    const overBudget = fill(R.overBudget, {
      price: item.price,
      budget: context.budgetGBP,
    });
    if (item.cheaperOk) {
      const alternative = `${item.cheaperOk.note} (£${item.cheaperOk.maxPrice})`;
      return settle(
        "WAIT",
        "over-budget",
        [quote, overBudget, fill(R.cheaperPointer, { note: item.cheaperOk.note })],
        { alternative },
      );
    }
    return settle("WAIT", "over-budget", [
      quote,
      overBudget,
      R.overBudgetNoAlternative,
    ]);
  }

  // Nothing stood in the way. Say why, rather than leaving her quote to
  // carry the whole card on its own.
  const clearReasons = [quote];
  if (item.verdictType === "situational") clearReasons.push(R.situationalFits);
  if (item.verdictType === "statement") clearReasons.push(R.statementFits);
  if (item.verdictType === "basic")
    clearReasons.push(fill(R.basicUnderCap, { cap: rules.basicCapGBP }));
  if (item.buyAgain === true) clearReasons.push(R.buyAgainTrue);
  if (clearReasons.length === 1) clearReasons.push(R.clearNothingAgainst);
  return settle("BUY", "clear", clearReasons);
}
