// Merges sofia.json, then patches, then overrides, and validates with zod.
// A patch that fails validation is rejected with an error naming the target
// and the field, and the previous state stays live.

import { z } from "zod";
import base from "@/data/sofia.json";
import type {
  Copy,
  Item,
  OverrideAnswer,
  Patch,
  Rules,
} from "@/lib/engine/types";

const StockSchema = z.enum(["in", "low", "one-off", "out"]);
const VerdictTypeSchema = z.enum([
  "investment",
  "basic",
  "statement",
  "situational",
  "avoid",
]);

// Only id, name, price, verdictType and quote are required. Everything else
// is optional here and gets a default when the item is normalised. Unknown
// fields ride along untouched.
const ItemInputSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  verdictType: VerdictTypeSchema,
  quote: z.string(),
  category: z.string().optional(),
  size: z.string().optional(),
  style: z.string().optional(),
  stock: StockSchema.optional(),
  buyAgain: z.boolean().nullable().optional(),
  caveat: z
    .object({ text: z.string(), severity: z.enum(["soft", "hard"]) })
    .optional(),
  pairsWith: z.array(z.string()).optional(),
  cheaperOk: z.object({ maxPrice: z.number(), note: z.string() }).optional(),
  seasonNote: z.string().optional(),
  fitNote: z.string().optional(),
  paid: z.boolean().optional(),
  link: z.string().optional(),
  evidence: z.array(z.string()).optional(),
  addedAt: z.string().optional(),
  image: z.string().optional(),
});

const RulesSchema = z.object({
  cpwMonths: z.number().positive(),
  cpwMaxGBP: z.number().positive(),
  basicCapGBP: z.number().positive(),
  maxPairings: z.number().int().positive(),
  wearsPerMonth: z.object({
    weekly: z.number().positive(),
    few: z.number().positive(),
    occasional: z.number().positive(),
  }),
  quietWinnerPer1000Views: z.number().positive(),
  suggestAfterRepeats: z.number().int().positive(),
  reviewAfterThumbsDown: z.number().int().positive(),
});

const SofiaDataSchema = z.object({
  rules: RulesSchema,
  ownedTags: z.array(z.string()),
  items: z.array(ItemInputSchema),
  copy: z.looseObject({
    takeLabels: z.record(z.string(), z.string()),
    callLabels: z.record(z.string(), z.string()),
    reasons: z.record(z.string(), z.string()),
    ui: z.record(z.string(), z.unknown()),
  }),
});

export type PatchError = {
  target: string;
  field: string;
  message: string;
};

export type LoadedData = {
  items: Item[];
  byId: Record<string, Item>;
  rules: Rules;
  copy: Copy;
  ownedTags: string[];
  overrides: Record<string, OverrideAnswer>;
  patchErrors: PatchError[];
};

type ItemInput = z.infer<typeof ItemInputSchema>;

// Fills the defaults so nothing downstream has to test for absence.
function normalise(input: ItemInput): Item {
  return {
    ...input,
    category: input.category ?? "",
    size: input.size ?? "",
    style: input.style ?? "",
    stock: input.stock ?? "in",
    buyAgain: input.buyAgain ?? null,
    pairsWith: input.pairsWith ?? [],
    paid: input.paid ?? false,
    evidence: input.evidence ?? [],
  } as Item;
}

function firstFieldOf(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue || issue.path.length === 0) return "(root)";
  return issue.path.join(".");
}

// A patch targets "rules", an existing item id, or a brand new item id.
function applyPatch(
  state: { rules: Rules; items: Map<string, ItemInput> },
  patch: Patch,
  errors: PatchError[],
): void {
  if (patch.target === "rules") {
    const candidate = {
      ...state.rules,
      ...patch.change,
      wearsPerMonth: {
        ...state.rules.wearsPerMonth,
        ...((patch.change.wearsPerMonth as object) ?? {}),
      },
    };
    const parsed = RulesSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({
        target: "rules",
        field: firstFieldOf(parsed.error),
        message: `Patch to rules rejected, field ${firstFieldOf(parsed.error)} is invalid. The previous rules stay live.`,
      });
      return;
    }
    state.rules = parsed.data;
    return;
  }

  const existing = state.items.get(patch.target);
  // The target is the id. A change carrying its own id would otherwise file
  // the item under a different one, which quietly overwrites whatever already
  // lives there and loses the piece that was patched.
  const candidate = existing
    ? { ...existing, ...patch.change, id: patch.target }
    : { ...patch.change, id: patch.target };

  const parsed = ItemInputSchema.safeParse(candidate);
  if (!parsed.success) {
    const field = firstFieldOf(parsed.error);
    errors.push({
      target: patch.target,
      field,
      message: existing
        ? `Patch to ${patch.target} rejected, field ${field} is invalid. The previous ${patch.target} stays live.`
        : `Patch creating ${patch.target} rejected, field ${field} is missing or invalid.`,
    });
    return;
  }
  state.items.set(patch.target, parsed.data);
}

export function loadData(
  opts: {
    patches?: Patch[];
    overrides?: Record<string, OverrideAnswer>;
    source?: unknown;
  } = {},
): LoadedData {
  const parsed = SofiaDataSchema.parse(opts.source ?? base);

  const state = {
    rules: parsed.rules as Rules,
    items: new Map<string, ItemInput>(parsed.items.map((i) => [i.id, i])),
  };

  const patchErrors: PatchError[] = [];
  for (const patch of opts.patches ?? []) {
    applyPatch(state, patch, patchErrors);
  }

  const items = [...state.items.values()].map(normalise);
  const byId: Record<string, Item> = {};
  for (const item of items) byId[item.id] = item;

  return {
    items,
    byId,
    rules: state.rules,
    copy: parsed.copy as unknown as Copy,
    ownedTags: parsed.ownedTags,
    overrides: opts.overrides ?? {},
    patchErrors,
  };
}

export { groupKey } from "@/lib/engine/keys";
