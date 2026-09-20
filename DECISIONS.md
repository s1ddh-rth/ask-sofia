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

---

## How the decision layer was built

This is the part worth explaining, because it is the whole product. The
question was how to get from a creator's offhand remarks to something that
can answer a stranger at 3am and still sound like her.

### Her words became fields, not prose

Every rule in the engine traces to something she actually said in the
evidence. Nothing was invented to fill a gap, and where the evidence was
silent the field is null rather than guessed.

| What she said | Where it went | What it does |
| --- | --- | --- |
| "£35 is enough" (E-04.4, E-05.1) | `rules.basicCapGBP: 35` and `white-tee.cheaperOk` | Any basic priced over £35 points at the cheaper one |
| "soft but pills" (E-04.7) | `grey-knit.caveat.severity: "hard"` | Overrules the item's own type and returns SKIP |
| "buy once, wear forever" (E-04.1) | `black-blazer.verdictType: "investment"` | Sends it down the cost per wear branch |
| "date-night shoe" (E-04.6) | `red-slingback.verdictType: "statement"` | Waits until there is somewhere to be |
| "looks insane, too warm" (E-05.1) | `vintage-leather.seasonNote` | Waits, and says why in her words |
| "3 things I truly love" | `rules.maxPairings: 3` | Caps how many pairings a card will name |

The test for whether something belongs in data rather than code is simple. If
Sofia could disagree with it, it is data. `basicCapGBP` is an opinion, so it
lives in `sofia.json`. The arithmetic that divides price by wears is not an
opinion, so it lives in `decide.ts`.

### Five verdict types, because she has five moods

The types came from sorting her eight pieces by how she talks about them, not
from a taxonomy. `investment` gets the cost per wear treatment.  `basic` gets
a price ceiling. `statement` needs an occasion. `situational` needs the right
day. `avoid` is a no. Each type is a different question, which is why each
gets its own branch rather than a shared score.

### First match wins, and the order is the opinion

`decide` walks its rules in a fixed order and the first that matches returns.
The order encodes what beats what, and that ordering is itself a judgement:

1. **Her confirmed answer** beats everything, including the engine.
2. **Stock** beats taste, because there is nothing to decide about a thing
   you cannot buy.
3. **A hard caveat** beats the item's type. The grey knit is an investment
   piece on paper, £78 and worn weekly is £1.63 a wear, which the cost per
   wear rule would happily call a BUY. Her "soft but pills" outranks the
   maths, so it returns SKIP. This is the clearest case of her judgement
   beating a number.
4. Then the type rules, then budget.

### Two worked examples

**A £60 white tee, worn weekly.** Not out of stock, no caveat, so it reaches
rule 4. It is a `basic` and £60 is over her £35 cap, so it returns WAIT with
`cheaperOk` attached. It never reaches the cost per wear rule, even though
£60 over a year of weekly wear is £1.25 a wear and would have passed easily.
That is deliberate. Her position on basics is a ceiling, not a calculation.

**The blazer at £145, worn weekly.** Reaches rule 5 as an `investment`. Four
wears a month over twelve months is 48 wears, so £3.02 a wear, under her £4
line, so BUY. Tap "now and then" instead and the same item is 6 wears,
£24.17 a wear, and the same rule returns WAIT. One input changed, the verdict
flipped, and the reason on the card is the arithmetic itself.

### Not knowing is a first class answer

Rule 10 exists because the failure mode that kills trust is a confident wrong
answer. Three things escalate rather than guess. An item she has not written
about. An investment piece with no idea how often it would be worn, because
the cost per wear is the entire argument and without it there is nothing to
say. Conflicting signals. Each one lands in her queue packaged with what they
tapped and what the engine did, so answering takes seconds.

### What the language model is allowed near

It turns "anything like this but under £120" into
`{job:"cheaper", budgetGBP:120}`. That is all. It never sees a verdict, never
writes a reason, and cannot invent an item id, because the output guardrail
checks every id against the loaded data and nulls anything else. The keyword
matcher behind it already scores 14 of 14 on the DM set, so the model is an
upgrade on a working floor rather than a dependency.

### The part that was cut

A scoring model that weighed all the signals together and returned a
confidence was considered and dropped. It would have made every verdict
unexplainable, and "Sofia says soft but pills" is worth more to a follower
than "0.31 confidence". Ordered rules make the card write itself.

## A shared link is a snapshot, and it doubles as the way back

`/api/share` writes the engine's verdict at the moment of sharing rather than
a link to the page. The verdict was personal to one wardrobe and one budget,
so sending someone the live page would show them a different answer to the one
being talked about, and the snapshot also survives Sofia later changing the
item. The route derives the verdict itself, so a shared link cannot be made to
say something the engine never said.

The same mechanism closes the escalation loop. Nothing is collected about the
person asking, and `sanitiseText` strips emails and phone numbers before
anything is stored, so there is no way to write back to them. Instead an
escalation hands back a link. It shows the verdict they had, and once Sofia
confirms an answer for that group the link shows her words too. No account, no
email, nothing to notify.

The snapshot carries its group key inside the stored JSON rather than in a new
column, so this needed no schema change.

## What counts as a repeated answer

The brief says repeated identical answers in the same group become a proposed
rule. Since an override is one per group by construction, the repetition being
counted is how many people that one answer is standing in for. Once a group
with a confirmed answer passes `suggestAfterRepeats`, currently three, the
studio proposes writing it into the item so the engine can say it without her.

The proposed patch is deliberately narrow. A repeated SKIP becomes a hard
caveat in her words, a repeated WAIT becomes a soft one, a repeated BUY sets
`buyAgain`. Anything the data cannot express faithfully proposes no patch at
all rather than inventing one, and she sees the exact change before approving.

The thumbs down heuristic proposes nothing on purpose. Two or more people
saying a verdict was not useful tells us something is wrong but not what, so
it opens the piece for her to look at instead of guessing at a fix.

Both thresholds live in `rules` in `sofia.json`, because how many repeats
count as a pattern is her judgement, not arithmetic.

## A patch is dry run before it is written

`/api/patch` replays the candidate patch against every patch already live and
refuses it with the offending field named if the merged result would not
validate. Nothing is written when it fails, so the previous state stays live,
which is the behaviour the brief asks for and the loader tests cover.

## worth-it is its own job

"Should I buy the blazer" and "help me use what I own" were sharing the
`should-buy` job, which put two different questions in one group and would
have had Sofia answering both with one reply. worth-it now means one piece
earning its place and should-buy means buying at all. The keyword matcher
checks the general patterns first so "shop less" cannot be read as a question
about an item, the Groq prompt spells the distinction out, and the eval has a
fixture for each. This changes the Job union in CLAUDE.md, which is recorded
there.

## One login, and only in front of the studio

Hard rule 8 said no auth. It now allows exactly one demo studio login and
nothing more, because anyone with the URL could otherwise push an override
live to every follower. The audience side stays completely open, since a
login in front of the thing judges are meant to try would defeat the point.

The session is a signed httpOnly cookie, not an account system. The HMAC uses
Web Crypto because middleware runs on the edge runtime where node crypto is
not available, and both the password check and the signature check compare in
constant time. When the three environment variables are missing the login
page names them, rather than failing in a way nobody can diagnose.

## Sample values are labelled as sample values

`data/posts.json` now carries `postedAt`, `audio` and `audioTitle`, and items
carry `addedAt`. The case pack gives none of these, and the ingest modes and
the newly added sort both need dates. Rather than quietly invent evidence,
the fixture says in its own first line which fields are made up.

## The ingest has two modes because the data has two shapes

A backfill and a nightly run are not the same job. The backfill is a window,
and runs once when she connects. The nightly run is everything since last
time plus a deliberate re-read of the last two days, because Instagram
insights lag by up to 48 hours and a number read last night is not always the
number today. Each post records why it is in the run, so a refreshed post is
distinguishable from a new one. The clock is injectable, which is what makes
the window arithmetic testable instead of assumed.
