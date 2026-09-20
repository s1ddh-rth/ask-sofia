// Demo data so the studio is not empty.
//
// Standalone on purpose. It reads .env.local itself and talks to Supabase
// over HTTP, so it shares no imports with the app and can run before the
// server does. Everything it writes is tagged source "seed", and it clears
// its own rows first, so running it twice leaves the same state rather than
// twice as much of it.

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
    "\n  Seeding needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
  console.error(
    "  Without them the app runs on in-memory state, which lives inside the server and cannot be seeded from out here.\n",
  );
  process.exit(1);
}

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY as string,
      Authorization: `Bearer ${KEY}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res;
}

type Row = Record<string, unknown>;

const BLAZER_BUY = {
  call: "BUY",
  ruleFired: "investment-cpw",
  reasons: [
    'Her words on it, "buy once, wear forever".',
    "Worn every week that is about 48 wears in 12 months, so roughly £3.02 a wear.",
    "She would buy it again.",
  ],
  costPerWear: 3.02,
  pairings: [],
  confident: true,
};

const KNIT_SKIP = {
  call: "SKIP",
  ruleFired: "hard-caveat",
  reasons: [
    'Her words on it, "soft but pills".',
    'Her note on this one is "soft but pills", and that is the whole problem.',
  ],
  pairings: [],
  caveat: "soft but pills",
  confident: true,
};

const SKIRT_BUY = {
  call: "BUY",
  ruleFired: "investment-cpw",
  reasons: [
    'Her words on it, "best with trainers".',
    "Worn a few times a month that is about 24 wears in 12 months, so roughly £3.96 a wear.",
    "Goes with what you already own, trainers.",
  ],
  costPerWear: 3.96,
  pairings: ["trainers"],
  confident: true,
};

const ESCALATED = {
  call: "ESCALATE",
  ruleFired: "escalate-unknown-item",
  reasons: ["Sofia has not written about this one yet."],
  pairings: [],
  confident: false,
};

// Six people asking whether the blazer is worth it, in their own words.
const blazerQuestions = [
  "Is the blazer actually worth £145 or am I being talked into it",
  "Ok but if you were me, which one would you actually buy?",
  "I've opened this three times. Still deciding.",
  "would you get the blazer again if you had to start over",
  "talk me out of the blazer please",
  "is the blazer worth it for someone who works from home",
];

// Four people who live in trainers and want the skirt to work anyway.
const skirtQuestions = [
  "I love the outfit but I live in trainers. How would you change it?",
  "does the silk skirt work with trainers or is that a crime",
  "can I wear this with trainers for a normal day",
  "trainers with a silk skirt, yes or no",
];

const questions: Row[] = [
  ...blazerQuestions.map((raw_text, i) => ({
    item_id: "black-blazer",
    job: "decide",
    group_key: "black-blazer:decide",
    context: { wear: "weekly", owns: ["white-tee"] },
    raw_text,
    source: "seed",
    verdict: BLAZER_BUY,
    rule_fired: BLAZER_BUY.ruleFired,
    latency_ms: 380 + i * 24,
    escalated: i < 2,
    note: i === 0 ? "I keep going back and forth on this one" : null,
  })),

  ...skirtQuestions.map((raw_text, i) => ({
    item_id: "silk-skirt",
    job: "adapt",
    group_key: "silk-skirt:adapt",
    context: { wear: "few", owns: ["trainers"] },
    raw_text,
    source: "seed",
    verdict: SKIRT_BUY,
    rule_fired: SKIRT_BUY.ruleFired,
    latency_ms: 410 + i * 18,
    escalated: i === 0,
    note: i === 0 ? "I genuinely own three pairs of trainers and no heels" : null,
  })),

  // Three people asking about something she has never written about.
  ...[
    "do you have linen trousers you actually rate",
    "linen trousers for a hot office, where from",
    "are linen trousers worth it if I crease everything",
  ].map((raw_text) => ({
    item_id: "linen-trousers",
    job: "should-buy",
    group_key: "linen-trousers:should-buy",
    context: { owns: [] },
    raw_text,
    source: "seed",
    verdict: ESCALATED,
    rule_fired: ESCALATED.ruleFired,
    latency_ms: 120,
    escalated: true,
    note: "Nothing on your page covers these and I trust you on fabric",
  })),

  // Two people who did not find the grey knit verdict useful.
  ...[
    "why does it say skip on the grey knit, mine is fine",
    "the grey knit answer feels harsh",
  ].map((raw_text) => ({
    item_id: "grey-knit",
    job: "should-buy",
    group_key: "grey-knit:should-buy",
    context: { wear: "weekly", owns: ["jeans"] },
    raw_text,
    source: "seed",
    verdict: KNIT_SKIP,
    rule_fired: KNIT_SKIP.ruleFired,
    latency_ms: 300,
    escalated: false,
    feedback: "down",
  })),
];

// Her answer to the blazer group, which is what the repeated answer
// heuristic then proposes turning into a rule.
const override = {
  group_key: "black-blazer:decide",
  answer: {
    call: "BUY",
    reasons: [
      "If you will wear it weekly, buy it. I have had mine four years and it has outlived everything I bought instead of it.",
    ],
  },
};

const shares: Row[] = [
  {
    ref: "demo4k2p",
    item_id: "black-blazer",
    verdict: {
      verdict: BLAZER_BUY,
      groupKey: "black-blazer:decide",
      context: { wear: "weekly", owns: ["white-tee"] },
    },
    opens: 4,
    buy_taps: 2,
  },
  {
    ref: "demo7nq3",
    item_id: "grey-knit",
    verdict: {
      verdict: KNIT_SKIP,
      groupKey: "grey-knit:should-buy",
      context: { wear: "weekly", owns: ["jeans"] },
    },
    opens: 1,
    buy_taps: 0,
  },
  {
    ref: "demo9xw5",
    item_id: "silk-skirt",
    verdict: {
      verdict: SKIRT_BUY,
      groupKey: "silk-skirt:adapt",
      context: { wear: "few", owns: ["trainers"] },
    },
    opens: 0,
    buy_taps: 0,
  },
];

async function main() {
  // Clear only what this script owns.
  await rest("questions?source=eq.seed", { method: "DELETE" });
  await rest("shares?ref=like.demo*", { method: "DELETE" });

  await rest("questions", {
    method: "POST",
    body: JSON.stringify(questions),
  });

  await rest("overrides", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([override]),
  });

  await rest("shares", { method: "POST", body: JSON.stringify(shares) });

  console.log(
    [
      "",
      "  Seeded.",
      `  ${questions.length} questions across 4 groups`,
      "  6 on the blazer, 4 on the silk skirt, 3 escalated on linen trousers she has never written about",
      "  2 thumbs down on the grey knit, which is enough to send it to review",
      "  1 answer from Sofia on the blazer group, which the repeated answer heuristic will propose as a rule",
      `  ${shares.length} shares, one with 4 opens and 2 buy taps`,
      "",
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error(`\n  Seeding failed: ${err.message}\n`);
  process.exit(1);
});
