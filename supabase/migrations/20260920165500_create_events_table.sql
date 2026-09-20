-- Anonymous behaviour, because the evidence says the decision happens over
-- days and somewhere else, and an affiliate click cannot see any of it.
-- A browser id is random and per browser. There is nothing personal here.
create table events (
  id uuid primary key default gen_random_uuid(),
  browser_id text,                 -- random, generated in the browser
  kind text,                       -- shown, saved, returned, shared, share_opened, checkin
  item_id text,
  group_key text,
  verdict_call text,               -- the call at the time of the event
  detail text,                     -- for a check-in, which answer they gave
  ref text,                        -- the share or come-back token, when relevant
  sample boolean default false,    -- true for seeded demo rows
  created_at timestamptz default now()
);

create index events_kind_idx on events (kind);
create index events_item_idx on events (item_id);
create index events_created_idx on events (created_at desc);

alter table events enable row level security;
