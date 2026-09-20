// Shared request validation for the API routes. Nothing reaches the engine
// or the store until it has been through one of these.

import { z } from "zod";

export const JobSchema = z.enum([
  "where",
  "decide",
  "cheaper",
  "size",
  "pairing",
  "adapt",
  "worth-it",
  "should-buy",
  "other",
]);

export const ContextSchema = z.object({
  wear: z.enum(["weekly", "few", "occasional"]).nullish(),
  budgetGBP: z.number().positive().max(100000).nullish(),
  owns: z.array(z.string().max(60)).max(20).default([]),
  occasion: z.boolean().nullish(),
});

export const CallSchema = z.enum(["BUY", "WAIT", "SKIP", "ESCALATE"]);

export const OverrideAnswerSchema = z.object({
  call: CallSchema,
  reasons: z.array(z.string().max(600)).min(1).max(6),
  alternative: z.string().max(300).optional(),
  caveat: z.string().max(300).optional(),
});

// The guardrail on free text. Caps length, strips anything that looks like a
// way to contact someone, and normalises whitespace.
export function sanitiseText(raw: string): string {
  return raw
    .slice(0, 500)
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "")
    .replace(/(\+?\d[\d\s()-]{7,}\d)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function toContext(parsed: z.infer<typeof ContextSchema>) {
  return {
    wear: parsed.wear ?? undefined,
    budgetGBP: parsed.budgetGBP ?? undefined,
    owns: parsed.owns ?? [],
    occasion: parsed.occasion ?? undefined,
  };
}

export function badRequest(error: z.ZodError) {
  const issue = error.issues[0];
  return {
    error: "Invalid request",
    field: issue ? issue.path.join(".") || "(root)" : "(root)",
    detail: issue?.message ?? "Could not read the request body.",
  };
}
