# Decisions

Kept in the order they were made, newest at the bottom.

## Scripts run TypeScript through Node's own type stripping

`npm run import`, `npm run seed` and `npm run reset` use
`node --experimental-strip-types` rather than adding a TypeScript runner.
Node 22.16 handles it, so this cost no dependency. The one constraint is that
relative imports inside those scripts need an explicit `.ts` extension.

`npm run eval` moved to vitest with its own config, because the eval imports
the parser and the loader through the `@/` alias and vitest already resolves
it. It still prints a score rather than asserting field by field, but it
fails if job accuracy drops below every message, so a regression cannot pass
quietly.

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

The repeated BUY case narrowed later. `buyAgain` came off the patch
allowlist, so a repeated BUY now proposes nothing at all, which the entry on
the nine field allowlist below explains.

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

## A patch may only touch an allowlist of fields

`/api/patch` takes whatever fields it is handed, and the studio sits behind
one shared demo login, so the route needed a list of what a patch is allowed
to set rather than a check on whichever field last caused a problem. The
`image` URL constraint that came out of the security review is still there,
but it is no longer the thing holding the door.

`PATCHABLE_ITEM_FIELDS` and `PATCHABLE_RULES_FIELDS` live in the loader, so
the check runs both at the route and again when patches are read back out of
the database. A rogue row written by some other means cannot slip a field in
either. `id` is deliberately absent, because the target is the id.

A patch carrying a forbidden field is refused whole, rather than having that
field quietly dropped and the rest applied. Silently ignoring part of what
someone asked for is how surprises happen, and the studio never sends one of
these anyway.

## The patch allowlist is nine fields, and that has two consequences

A patch may set quote, price, stock, verdictType, caveat, cheaperOk,
seasonNote, fitNote and pairsWith. Everything else is refused with the field
named, including image, link, name, paid, evidence and buyAgain. The list
lives in the loader so it applies at the route and again when patches are
read back from the database.

Two things follow from it, both deliberate.

A patch can no longer create a new item, because a new piece needs a name
and name is not on the list. Adding a piece is an edit to sofia.json through
the importer, not something the studio can do to the live app.

A repeated BUY no longer proposes a patch. It used to set buyAgain, which is
off the list now, and nothing that remains expresses "she would buy it
again". Rather than invent a field to write, it proposes nothing and says
why, which is what the thumbs down heuristic already did.

## What is public, what is private, and where each lives

Her confirmed answer is public. It belongs to the group, not to the person
who happened to ask first, so it shows on the item page under "Sofia answered
this" with her words and her call and nothing else. The studio says so where
she types it, because the reply box is the only place that decision is made.

Everything the asker contributed is private. Their text, their note and their
taps are never rendered on a public page. They appear in the studio, which is
behind the login, and on their own come-back link, which only they hold.

Those links are sixteen random characters from an unambiguous alphabet,
roughly seventy nine bits, and never sequential. They also carry a noindex
tag, since somebody's own answer has no business in a search result.

## Followers keep their answers without an account

A follower who asks Sofia something gets a link back, and that link is now
also remembered in their own browser under "Your questions" with a waiting or
answered marker. It is localStorage and nothing else. No account, no email,
no row anywhere that ties a link to a person.

The answered marker needs a server round trip, so `/api/mine` takes a list of
refs and returns which of them she has answered. It only ever accepts refs
the caller already holds and returns only refs and a boolean, so it reveals
nothing they could not see by opening each link themselves.

Clearing the browser loses the list. That is the trade for having no account,
and the screen says so rather than pretending otherwise.

## An override is re-checked when it is read back, like a patch

Patches are validated on the way in and again on the way out. Overrides were
only checked on the way in, which left an asymmetry. A row missing its
reasons would have reached the "Sofia answered this" block and the shared
verdict page, both of which map over reasons, and taken the audience page
down for everyone. A row with a reason far longer than the route allows would
have rendered as hers.

`getOverrides` now runs each row through the same schema the route uses and
drops the ones that fail. The engine then falls back to its own verdict for
that group, which is the safe direction to fail in, since the worst case is
a follower seeing the rule based answer instead of her words.

## Her take is derived the same way the verdict is

The grey knit is an `investment` piece in the data, exactly as the brief
specified, and it also carries a hard caveat, "soft but pills". Rule 3 says a
hard caveat beats the item's type, so the engine returns SKIP for it in every
context. The card, though, read its label straight off `verdictType` and so
announced "Worth the money" directly above a verdict of "Skip it".

The engine was right and the label was lying. Two different things were
deciding what to show. `lib/engine/take.ts` now derives the label the same way
the verdict is derived, so a piece that can only ever be skipped says so.

A test sweeps all eight pieces across every context the taps can produce and
fails if any label contradicts the set of verdicts that piece can return, in
either direction. The grey knit was the only one, but the test is there so the
next item added cannot reintroduce it quietly.

## D-18 Design for the considered decision, not the click

E-09 says 62% of high value buyers never clicked her affiliate link, the
median gap from saving to buying is 3.4 days, 41% of purchases followed a
share to a friend or partner, and people who saved three or more looks bought
2.2 times as often. E-10 says 7 of 9 buyers never clicked, and every one of
those had saved at least three looks and come back at least twice.

So the click is not the behaviour. The behaviour is a decision taken over
days, revisited, shared with someone else, and completed somewhere we cannot
see. An affiliate dashboard measures the one moment that behaviour skips.

Three things follow, and they are what the product now does. Leaving and
coming back has to work without an account, so the shortlist and their
questions live in their own browser. Sharing has to carry her reasoning
rather than a product, because a partner is often the one deciding. And since
the purchase happens out of sight, the only honest way to know is to ask,
once, anonymously, when they return.

That is what "Decisions you shaped" counts. Verdicts given, saved, came back,
shared, opened, and then the answer to did you buy it, split by whether it
went through her link. The last number is the one her affiliate dashboard
cannot produce.
