// CSV to sofia.json items, for new wardrobe data.
//
//   npm run import -- wardrobe.csv
//
// Standalone, like the seed, so it shares no imports with the app. It merges
// rather than replaces, writes a .bak first, and refuses the whole file if
// any row is malformed, so a bad import cannot leave sofia.json half written.

import fs from "node:fs";
import path from "node:path";

const VERDICT_TYPES = [
  "investment",
  "basic",
  "statement",
  "situational",
  "avoid",
];
const STOCKS = ["in", "low", "one-off", "out"];

// Handles quoted fields with commas inside them, which item names have.
function splitRow(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(field.trim());
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field.trim());
  return out;
}

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const file = process.argv[2];
if (!file) fail("Give it a file. npm run import -- wardrobe.csv");

const csvPath = path.resolve(process.cwd(), file);
if (!fs.existsSync(csvPath)) fail(`No such file: ${csvPath}`);

const lines = fs
  .readFileSync(csvPath, "utf8")
  .split(/\r?\n/)
  .filter((l) => l.trim() !== "");
if (lines.length < 2) fail("That file has a header and no rows.");

const header = splitRow(lines[0]).map((h) => h.toLowerCase());
const REQUIRED = ["id", "name", "price", "verdicttype", "quote"];
const missing = REQUIRED.filter((r) => !header.includes(r));
if (missing.length > 0) {
  fail(`Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
}

const NUMERIC = new Set(["price"]);
const LIST = new Set(["pairswith", "evidence"]);
const KEY: Record<string, string> = {
  verdicttype: "verdictType",
  pairswith: "pairsWith",
  buyagain: "buyAgain",
  seasonnote: "seasonNote",
  fitnote: "fitNote",
};

const incoming: Record<string, unknown>[] = [];

lines.slice(1).forEach((line, i) => {
  const cells = splitRow(line);
  const row: Record<string, unknown> = {};
  const where = `row ${i + 2}`;

  header.forEach((column, c) => {
    const raw = cells[c] ?? "";
    if (raw === "") return;
    const key = KEY[column] ?? column;

    if (NUMERIC.has(column)) {
      const n = Number(raw);
      if (!Number.isFinite(n)) fail(`${where}: ${column} is not a number, got "${raw}"`);
      row[key] = n;
    } else if (LIST.has(column)) {
      row[key] = raw.split(/[;|]/).map((v) => v.trim()).filter(Boolean);
    } else if (column === "buyagain") {
      row[key] = raw === "true" ? true : raw === "false" ? false : null;
    } else if (column === "paid") {
      row[key] = raw === "true";
    } else {
      row[key] = raw;
    }
  });

  for (const required of ["id", "name", "price", "verdictType", "quote"]) {
    if (row[required] === undefined) fail(`${where}: ${required} is empty`);
  }
  if (!VERDICT_TYPES.includes(row.verdictType as string)) {
    fail(`${where}: verdictType must be one of ${VERDICT_TYPES.join(", ")}, got "${row.verdictType}"`);
  }
  if (row.stock !== undefined && !STOCKS.includes(row.stock as string)) {
    fail(`${where}: stock must be one of ${STOCKS.join(", ")}, got "${row.stock}"`);
  }

  incoming.push(row);
});

const dataPath = path.join(process.cwd(), "data", "sofia.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const existing: Record<string, unknown>[] = data.items;

let added = 0;
let updated = 0;
for (const row of incoming) {
  const at = existing.findIndex((item) => item.id === row.id);
  if (at === -1) {
    existing.push(row);
    added += 1;
  } else {
    // Merge, so a partial CSV cannot wipe fields it does not mention.
    existing[at] = { ...existing[at], ...row };
    updated += 1;
  }
}

fs.copyFileSync(dataPath, `${dataPath}.bak`);
fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);

console.log(
  `\n  ${added} added, ${updated} updated, ${existing.length} pieces now.\n  Previous file kept at data/sofia.json.bak\n  Run npm test before committing.\n`,
);
