# Ask Sofia

Sofia's followers ask her the same questions all day and they do not want links, they want her judgement. This turns her written rules into instant personal verdicts, sends anything it cannot answer to her queue, and only learns from what she approves.

Built for the Tano Creator Heist, Case 002, Operation Lookbook.

## How it works

A rules engine decides every verdict. It is a pure function with no I/O, so the same input always gives the same output. Sofia's taste lives in data, never in code, as `data/sofia.json` merged with patches and then overrides.

The language model only turns free text into a validated schema and drafts suggestion wording. It never writes or changes a verdict. If the engine is not confident the answer is an escalation to Sofia, never a guess.

Every screen still works when the services are down. Groq falls back to a keyword matcher and Supabase falls back to in-memory state.

## Running it

```
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

`npm test` runs the engine and loader tests. `npm run eval` runs the DM parser eval. `npm run seed` loads demo data.

See `CLAUDE.md` for the full brief and the rules this build is held to.
