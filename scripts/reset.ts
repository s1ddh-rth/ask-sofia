// Clears the demo state and seeds it again. Run it right before a demo.
//
//   npm run reset
//
// It removes every question, override and patch, not only the seeded ones,
// because the point is a known starting state. Shares are left alone unless
// they are the seed's own, so a link handed out earlier keeps working.

import fs from "node:fs";
import path from "node:path";

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

loadEnvLocal();

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !KEY) {
  console.error(
    "\n  Reset needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.\n",
  );
  process.exit(1);
}

async function wipe(table: string, filter: string) {
  const res = await fetch(`${URL_BASE}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: {
      apikey: KEY as string,
      Authorization: `Bearer ${KEY}`,
      "content-type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`clearing ${table} failed: ${res.status} ${await res.text()}`);
  }
  console.log(`  cleared ${table}`);
}

async function main() {
  console.log("\n  Resetting.");
  // PostgREST refuses an unfiltered delete, so each filter matches everything.
  await wipe("questions", "id=not.is.null");
  await wipe("overrides", "group_key=not.is.null");
  await wipe("patches", "id=not.is.null");
  await wipe("posts", "id=not.is.null");
  // Seeding runs on import. The specifier is built at runtime because node
  // wants the extension and TypeScript will not accept one written inline.
  const seed = "./seed" + ".ts";
  await import(seed);
}

main().catch((err) => {
  console.error(`\n  Reset failed: ${err.message}\n`);
  process.exit(1);
});
