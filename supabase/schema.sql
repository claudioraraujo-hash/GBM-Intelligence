-- GBM Intelligence — Tabela de usuários (cadastro / aprovação / planos)
-- Rode isto no Supabase: painel do projeto → SQL Editor → New query → cole e "Run".

create table if not exists usuarios (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  email          text not null unique,
  empresa        text,
  telefone       text,
  senha_hash     text not null,
  plano          text,                       -- free | business | pro | null (pendente)
  status         text not null default 'pendente',  -- pendente | aprovado | rejeitado
  creditos_prosp integer not null default 0, -- créditos semanais da Prospecção Avançada (Business)
  semana_ref     text,                        -- segunda-feira (YYYY-MM-DD) da última recarga
  criado_em      timestamptz not null default now(),
  aprovado_em    timestamptz
);

-- Segurança: bloqueia acesso pela chave pública (anon).
-- As funções do servidor usam a service_role key, que ignora o RLS.
alter table usuarios enable row level security;
