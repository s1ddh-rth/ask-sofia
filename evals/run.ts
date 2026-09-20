// Scores the parser against the twelve real DMs from E-01.
//
// Run it with `npm run eval`. With GROQ_API_KEY set it scores the model and
// falls back per message when the model fails. Without a key it scores the
// keyword matcher on its own, which is the floor the model has to beat.

import fs from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import dms from "@/evals/dms.json";
import { loadData } from "@/lib/data/load";
import { parseQuestion } from "@/lib/parse/groq";

// vitest does not read .env.local, and secrets never belong in the repo.
function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    if (value && !process.env[match[1]]) process.env[match[1]] = value;
  }
}

type Expected = {
  id: number;
  text: string;
  job: string;
  itemId: string | null;
  budgetGBP?: number;
  wear?: string;
  owns?: string[];
  occasion?: boolean;
};

const FIELDS = ["itemId", "budgetGBP", "wear", "owns", "occasion"] as const;

function fieldMatches(
  field: (typeof FIELDS)[number],
  expected: Expected,
  got: Record<string, unknown>,
): boolean | null {
  if (field === "itemId") return got.itemId === expected.itemId;
  // Only score a field the fixture actually asserts. Everything else is
  // expected to be absent.
  if (!(field in expected)) {
    const value = got[field];
    if (field === "owns") return Array.isArray(value) && value.length === 0;
    return value === null || value === undefined;
  }
  if (field === "owns") {
    return (
      JSON.stringify([...((got.owns as string[]) ?? [])].sort()) ===
      JSON.stringify([...(expected.owns ?? [])].sort())
    );
  }
  return got[field] === expected[field];
}

it(
  "scores the parser against the E-01 DMs",
  { timeout: 120000 },
  async () => {
    loadEnvLocal();
    const { items, ownedTags } = loadData();

    const model = process.env.GROQ_API_KEY
      ? (process.env.GROQ_MODEL ?? "unset GROQ_MODEL")
      : "none, scoring the keyword matcher";

    let jobHits = 0;
    let fieldHits = 0;
    let fieldTotal = 0;
    const sources: Record<string, number> = {};
    const latencies: number[] = [];
    const mismatches: string[] = [];

    for (const dm of dms as Expected[]) {
      const { parsed, source, latencyMs } = await parseQuestion(
        dm.text,
        items,
        ownedTags,
      );
      sources[source] = (sources[source] ?? 0) + 1;
      latencies.push(latencyMs);

      if (parsed.job === dm.job) jobHits += 1;
      else
        mismatches.push(
          `  #${dm.id} job: expected ${dm.job}, got ${parsed.job}\n     "${dm.text}"`,
        );

      for (const field of FIELDS) {
        fieldTotal += 1;
        const ok = fieldMatches(
          field,
          dm,
          parsed as unknown as Record<string, unknown>,
        );
        if (ok) fieldHits += 1;
        else
          mismatches.push(
            `  #${dm.id} ${field}: expected ${JSON.stringify(
              field in dm ? dm[field as keyof Expected] : "absent",
            )}, got ${JSON.stringify(
              (parsed as unknown as Record<string, unknown>)[field],
            )}`,
          );
      }
    }

    const total = dms.length;
    const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;
    const median = [...latencies].sort((a, b) => a - b)[
      Math.floor(latencies.length / 2)
    ];

    const report = [
      "",
      "  Parser eval, E-01 DMs",
      `  Model            ${model}`,
      `  Job accuracy     ${jobHits}/${total}  ${pct(jobHits, total)}`,
      `  Field accuracy   ${fieldHits}/${fieldTotal}  ${pct(fieldHits, fieldTotal)}`,
      `  Source           ${Object.entries(sources)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ")}`,
      `  Median latency   ${median}ms`,
      mismatches.length === 0
        ? "  Mismatches       none"
        : `  Mismatches\n${mismatches.join("\n")}`,
      "",
    ].join("\n");

    // vitest intercepts console, and this report is the whole point.
    process.stdout.write(`${report}\n`);

    // The keyword matcher already scores 12 of 12. Anything in front of it
    // has to at least hold that line.
    expect(jobHits).toBeGreaterThanOrEqual(total);
  },
);
