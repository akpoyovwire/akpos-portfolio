-- Run this ONCE in Supabase: SQL Editor -> New query -> paste -> Run.
-- It creates the private table where Mon IA's recorded chats are kept.

create table if not exists public.mon_ia_messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid        not null,
  created_at      timestamptz not null default now(),
  question        text        not null,
  answer          text        not null,
  kind            text        not null default 'answer',
  policy_version  text        not null,
  emailed_at      timestamptz
);

create index if not exists mon_ia_messages_created_idx on public.mon_ia_messages (created_at);
create index if not exists mon_ia_messages_unsent_idx  on public.mon_ia_messages (created_at) where emailed_at is null;

-- Row Level Security ON with NO policies = nobody can read or write from the browser.
-- Only the server, using the secret key, can touch this table.
alter table public.mon_ia_messages enable row level security;
revoke all on public.mon_ia_messages from anon, authenticated;
