# Ask Sofia

Sofia Bennett is a London fashion creator (50K followers across Instagram and TikTok) whose followers DM her the same questions all day. They don't want links, they want her judgement, which only exists when she is awake. This app turns her written rules into instant, personal "is it worth it for me?" verdicts, sends anything it can't answer to her, and learns only from what she approves.

Built solo in one day for the Tano Creator Heist (Case 002, Operation Lookbook). Submission is 6pm. Judges score on whether Sofia would use it, trust it, whether her audience would use it, and whether she'd share it. Simple and working beats clever and broken.

## Hard rules (never break these)

1. The rules engine decides every verdict. The LLM only turns free text into a validated schema and drafts suggestion wording. It never writes, changes or overrides a verdict.
2. Sofia's taste lives in `data/sofia.json`, the `patches` table and the `overrides` table. Never put item-specific logic in code.
3. Nothing changes the live app without Sofia's approval. No automatic learning from user behaviour.
4. Paid or affiliate status is shown as a disclosure and never affects the verdict.
5. If the engine is not confident, the answer is ESCALATE to Sofia's queue. Never invent an answer.
6. The same input always gives the same output. No retry or re-roll buttons. Users can change their inputs instead.
7. Every screen must still work if Groq or Supabase is down. Groq falls back to the keyword matcher. Supabase falls back to in-memory state.
8. No vector database, no agents, no chat thread, no auth beyond the single demo studio login, no new dependencies without asking first.
9. Mobile first. Judges will open it on their phones.
10. Secrets stay server-side. Groq and Supabase are only called from API routes. Never commit `.env.local`, and never commit photos or scans of the case file.

## Stack

Next.js (App Router) with TypeScript and Tailwind, deployed on Vercel through GitHub, so every push to main deploys. Supabase Postgres for shared state, accessed only from server routes with the service role key. Groq for free-text parsing and suggestion drafts. zod for validation, vitest for tests.

The Supabase MCP in Claude Code is for setting up and inspecting the database only. The app never uses it.

## Visual style

Follows the Tano case file. Tailwind tokens paper #EDE8E1, card #F6F3EE, ink #1C1C1C, muted #6B6760, rust #B5452F. Headings in Barlow Condensed bold, labels in IBM Plex Mono uppercase, body in Inter. The verdict shows as a slightly rotated stamp in rust. Minimal, lots of whitespace, one accent colour.

## The audience flow

1. A follower opens `/s/[item]` from Sofia's post, bio or DM reply.
2. Sofia's own take shows immediately (her verdict type and quote) with no input needed.
3. To personalise, they either tap (how often they'd wear it, budget, what they own, occasion) or type one question into a single question box. The box returns a verdict card. It is not a chat thread and keeps no conversation history.
4. The verdict card shows the call, her reasons, cost per wear, pairings, an alternative or caveat, and a paid disclosure if relevant. It has a share button and a thumbs down.
5. A bar pinned to the bottom of the screen at all times reads "Still unsure? Ask Sofia herself". It sends the item, their context, the verdict they got and an optional note to Sofia's queue.

## Layout

```
data/sofia.json            items, rules, thresholds, quotes, UI copy and reason templates
data/posts.json            fixture of the five E-03 posts for the ingest demo
lib/data/load.ts           merges sofia.json, then patches, then overrides, validates with zod
lib/engine/types.ts        Item, Rules, UserContext, Verdict, ParsedQuestion, Patch
lib/engine/decide.ts       pure verdict function, no I/O
lib/parse/groq.ts          free text to ParsedQuestion via Groq, with guardrails
lib/parse/fallback.ts      keyword matcher used when Groq fails or is unavailable
lib/suggest/heuristics.ts  suggestions from the logs, pure counting, no model required
lib/ingest/posts.ts        post ingest, today reads the fixture, in production a nightly job
lib/store.ts               Supabase access with an in-memory fallback
app/s/[item]/page.tsx      audience view, question box, verdict card, pinned Ask Sofia bar
app/v/[ref]/page.tsx       shared verdict view, logs opens and buy taps
app/studio/page.tsx        queue, grouped questions, suggestions, edits, counters, sync posts
app/api/ask/route.ts       parse, decide, log
app/api/escalate/route.ts  pinned bar sends a packaged question to the queue
app/api/answer/route.ts    Sofia's reply becomes an override after she confirms it
app/api/patch/route.ts     approve a suggestion or save a direct edit as a patch
app/api/share/route.ts     create a share ref with a snapshot of the verdict, track opens and buy taps
app/api/feedback/route.ts  thumbs down on a verdict
app/api/ingest/route.ts    runs the post ingest over the fixture
scripts/import.ts          CSV to sofia.json items, for new wardrobe data
scripts/seed.ts            demo questions, shares and feedback so the studio isn't empty
tests/engine.test.ts       golden verdict cases
tests/load.test.ts         merge order and patch validation
evals/dms.json             the 12 DMs from evidence E-01 with expected fields
evals/run.ts               parser eval, prints a score
```

## Data shapes

```ts
type VerdictType = "investment" | "basic" | "statement" | "situational" | "avoid";
type Job = "where" | "decide" | "cheaper" | "size" | "pairing" | "adapt" | "worth-it" | "should-buy" | "other";

type Item = {
  id: string;
  name: string;
  category: string;
  price: number;                        // GBP
  size: string;
  style: string;
  stock: "in" | "low" | "one-off" | "out";
  verdictType: VerdictType;
  quote: string;                        // her exact words
  buyAgain: boolean | null;             // null when the evidence doesn't say
  caveat?: { text: string; severity: "soft" | "hard" };
  pairsWith: string[];                  // item ids or owned-basic tags
  cheaperOk?: { maxPrice: number; note: string };
  seasonNote?: string;
  fitNote?: string;
  paid: boolean;
  link?: string;
  evidence: string[];                   // sheet refs, e.g. "E-04.1"
};

type Rules = {
  cpwMonths: number;                    // demo assumption
  cpwMaxGBP: number;                    // demo assumption
  basicCapGBP: number;                  // from "£35 is enough"
  maxPairings: number;                  // from "3 things I truly love"
  wearsPerMonth: { weekly: number; few: number; occasional: number };
};

type UserContext = {
  wear?: "weekly" | "few" | "occasional";
  budgetGBP?: number;
  owns: string[];
  occasion?: boolean;
};

type Verdict = {
  call: "BUY" | "WAIT" | "SKIP" | "ESCALATE";
  ruleFired: string;                    // shown in the studio as the "why" line
  reasons: string[];                    // built from her quotes and templates, never from the LLM
  costPerWear?: number;
  pairings: string[];
  alternative?: string;
  caveat?: string;
  paidDisclosure?: boolean;
  confident: boolean;
};

type ParsedQuestion = {
  job: Job;
  itemId: string | null;
  budgetGBP: number | null;
  wear: "weekly" | "few" | "occasional" | null;
  owns: string[];
  occasion: boolean | null;
};

type Patch = {
  target: string;                       // item id, a new item id, or "rules"
  change: Partial<Item> | Partial<Rules>;
  reason: string;                       // the suggestion or edit it came from
};
```

Item quotes are shown to the audience as "Sofia’s take" with the evidence ref beside them in small text, on the browse grid and on the item page alike, so a claim can always be traced back to the sheet it came from. All schema fields beyond id, name, price, verdictType and quote are optional in the loader. Unknown fields pass through untouched. UI copy and reason templates live in `sofia.json` under `copy`, so tone changes are data edits. A patch that fails validation is rejected with an error naming the target and field, and the previous state stays live.

## Engine rule order (`decide`)

1. An override exists for this item and job group, so return Sofia's answer.
2. Stock is out, so WAIT, with her accepted alternative if one exists.
3. `avoid`, or a caveat with severity hard, gives SKIP with her words.
4. `basic` above `basicCapGBP` points to the cheaper version.
5. `investment` works out cost per wear over `cpwMonths`. Under `cpwMaxGBP` is BUY, over is WAIT.
6. `statement` with no occasion is WAIT.
7. `situational` is WAIT with `seasonNote` unless the context fits.
8. Over budget shows `cheaperOk` if it exists, otherwise WAIT.
9. Pairings are the intersection of `pairsWith` and `owns`, capped at `maxPairings`.
10. An unknown item, missing required context or conflicting signals gives ESCALATE.

Paid status is attached as `paidDisclosure` after the verdict is decided and is never read by any rule.

## Groq parser

The input guardrail caps text at 500 characters, strips emails and phone numbers, and skips the model for clearly off-topic messages. The model is called at temperature 0 in JSON mode with the `ParsedQuestion` schema in the prompt. The output guardrail validates with zod and checks that `itemId` exists in the merged data. Any failure falls back to `fallback.ts`. Every call logs its source as taps, groq or fallback. The model name comes from `GROQ_MODEL`.

## Supabase tables

```sql
create table questions (
  id uuid primary key default gen_random_uuid(),
  item_id text, job text, group_key text,      -- item_id || ':' || job
  context jsonb, raw_text text, source text,
  verdict jsonb, rule_fired text, latency_ms int,
  escalated boolean default false, note text, feedback text,
  created_at timestamptz default now()
);
create table overrides (
  group_key text primary key,
  answer jsonb,
  confirmed_at timestamptz default now()
);
create table patches (
  id uuid primary key default gen_random_uuid(),
  target text,                                 -- item id or 'rules'
  change jsonb,
  reason text,
  approved_at timestamptz default now()
);
create table shares (
  ref text primary key, item_id text,
  verdict jsonb,                               -- snapshot at share time
  opens int default 0, buy_taps int default 0,
  created_at timestamptz default now()
);
create table posts (
  id text primary key, title text,
  views int, saves int, purchases int,
  item_ids text[], status text default 'draft',  -- draft until Sofia confirms
  ingested_at timestamptz default now()
);
```

## Escalation

The pinned bar is the only way to reach Sofia, and it is always visible on the audience page. Questions reach her packaged with the item, the person's context, the verdict given and their note. Questions are grouped by `group_key`, never by text similarity. Sofia's reply is shown back to her in structured form and saved as an override only after she confirms. Thumbs down on a verdict feeds the suggestions panel.

## How the system adapts

Sofia's judgement updates the live app in three ways, and only these. Her answer to a grouped question becomes an override immediately. Suggestions from `lib/suggest/heuristics.ts` appear in the studio for her to approve, and approved suggestions are saved as patches. She can also edit items and rules directly from the studio, which also saves patches. Groq may draft the wording of a suggestion from her past replies, but the heuristics decide what gets suggested and Sofia decides what goes live. Every patch is kept with a timestamp, which gives history.

The two heuristics are repeated identical answers in the same group becoming a proposed rule, and verdicts with two or more thumbs down going to review.

## Post ingest

`lib/ingest/posts.ts` runs in two modes and never calls a real external API today. Both read `data/posts.json`, match posts to items by name and never by category, flag quiet winners at ten or more purchases per thousand views as in E-03.4, and store everything as a draft for Sofia to confirm, because a post shows what she wore and not her verdict.

Backfill takes a date window, twelve months by default. In production this is the run that happens once, when she first connects her account, since Meta keeps post metrics for up to two years.

Nightly takes anything posted since the last run, plus a refresh of the last two days. The refresh matters because Instagram insights can lag by up to 48 hours, so a number read last night is not always the number today. Each post carries why it is in the run, so a refreshed post is distinguishable from a new one.

Both run from their own button in the studio today. The clock is injectable, so the window arithmetic is tested rather than assumed, and an undated post is never silently dropped from a backfill.

The dates and audio fields in `data/posts.json` are sample values, marked as such in the file, because the case pack gives neither.

## Commands

`npm run dev` runs locally. `npm test` runs the engine and loader tests. `npm run eval` runs the DM parser eval. `npm run import -- file.csv` merges new items into `sofia.json`. `npm run seed` loads demo data. `npm run reset` clears questions, overrides, patches and posts and reseeds, for a known state before a demo.

## Tests that must always pass

A weekly-worn blazer gives BUY. The grey knit gives SKIP with "soft but pills". A £60 white tee points to the £35 version. The red slingback with no occasion gives WAIT. An out-of-stock item gives WAIT. An unknown item gives ESCALATE. A confirmed override returns Sofia's answer. A paid item gets the same verdict as an identical unpaid one. A patch changes the verdict it should, overrides beat patches, and an invalid patch is rejected while the previous state stays live.

## Curveballs (16:00 intelligence drop)

Core flow must be deployed before 16:00. When new evidence arrives, sort each point into data, rule, copy or pitch. Data goes into `sofia.json` or through `npm run import`. A rule becomes one engine rule plus one golden test. Copy is a template edit in `sofia.json`. Anything bigger becomes a line in the demo, not new code. Never rebuild the architecture in response to the drop.

## Build priority

Build in this order and deploy after each step. First, the engine with passing tests. Second, the audience flow with the verdict card and pinned bar. Third, the escalation queue, studio answers and overrides. Fourth, Groq parsing with fallback and the DM eval. Fifth, sharing with snapshots. Sixth, suggestions and patches. Seventh, the post ingest fixture and studio counters. Anything in `LATER.md` is only started once all seven are done.

## Working style

Make small commits with clear messages. Run tests before every commit. When a decision changes, add an entry to `DECISIONS.md`. Feature freeze is at 17:00, after which only data changes and fixes. Ask before adding dependencies or changing the data schema. Write docs and UI copy in plain conversational prose, without em dashes, colons or semicolons in sentences.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
