-- Ask Sofia shared state. Read and written only from server routes
-- with the service role key, which bypasses RLS.

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

-- The studio groups the queue by group_key and reads newest first.
create index questions_group_key_idx on questions (group_key);
create index questions_created_at_idx on questions (created_at desc);

-- No client ever talks to these tables directly, so RLS is enabled with no
-- policies. That denies the anon and authenticated roles outright while the
-- service role used by the server routes passes straight through.
alter table questions enable row level security;
alter table overrides enable row level security;
alter table patches   enable row level security;
alter table shares    enable row level security;
alter table posts     enable row level security;
