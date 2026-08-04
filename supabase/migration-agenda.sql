-- GBM Intelligence — Agenda (integração Google Calendar + Microsoft Outlook)
-- Rode isto no Supabase: painel do projeto → SQL Editor → New query → cole e "Run".
-- Guarda os tokens OAuth (uma linha por provedor — recurso pessoal do Master).

create table if not exists agenda_tokens (
  provider       text primary key,      -- 'google' | 'microsoft'
  refresh_token  text not null,
  access_token   text,
  expires_at     timestamptz,
  atualizado_em  timestamptz not null default now()
);

alter table agenda_tokens enable row level security;
