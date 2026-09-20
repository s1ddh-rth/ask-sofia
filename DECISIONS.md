# Decisions

Kept in the order they were made, newest at the bottom.

## Scripts run TypeScript through Node's own type stripping

`npm run eval`, `npm run import` and `npm run seed` use
`node --experimental-strip-types` rather than adding a TypeScript runner.
Node 22.16 handles it, so this cost no dependency. The one constraint is that
relative imports inside those scripts need an explicit `.ts` extension.

## Row level security is on with no policies

Supabase exposes every public table through PostgREST to the publishable key,
which is public by design. Without RLS anyone could read and write Sofia's
queue and her overrides. Enabling RLS with no policies denies the anon and
authenticated roles outright, while the service role the server routes use
passes straight through. Nothing in the app changes.

## The default model is openai/gpt-oss-120b

The parser's hard cases are the ambiguous DMs, which is where a stronger model
earns its place. `GROQ_MODEL` is env driven so this is a config change, and the
P5 eval scores it against the alternative rather than settling it on taste.

## A quiet winner threshold lives in the rules

The post ingest needs a number for "high purchases relative to views", so
`quietWinnerPer1000Views` sits in `rules` in `sofia.json` rather than in code.
It is a threshold, and thresholds are data.

## The engine follows the rule order literally

`decide` treats rules 2 to 8 as first match wins, exactly as written. This
means an investment item that clears its cost per wear returns BUY before the
budget rule is ever reached, so a £145 blazer worn weekly is a BUY even when
the person said their budget was £100. That follows the spec as given. If the
intent is that budget should beat a good cost per wear, it is one reordering
plus one golden test.

## Supabase is reached over plain fetch, not the client library

`@supabase/supabase-js` would have been a new dependency and rule 8 says ask
first. PostgREST over `fetch` is about forty lines, keeps nothing extra in the
bundle, and every call falls back to in-memory state when the database is
absent or unreachable. Swapping to the client library later is contained.

## The audience page renders per request

`/s/[item]` was statically prerendered until overrides existed. Sofia's
confirmed answers have to reach the page the moment she saves one, so it now
renders on each request and passes the merged data to the client. The engine
still runs in the browser, so the page keeps working with no backend.

## Asks are logged without the verdict waiting on it

The verdict is computed in the browser and shown immediately. The log to
`/api/ask` is fired afterwards, debounced, and a failure changes nothing the
person sees. That keeps rule 7 true while still filling her queue.

## The escalation route derives the verdict itself

`/api/escalate` used to write the verdict the client sent it. Sofia answers
from what she reads in the queue, so a caller could have put words in her
followers' mouths. The route now re-derives it from the item and the context
with the same engine. Because `decide` is deterministic this is the same
answer the person saw, and it is now the engine's answer rather than anyone
else's.
