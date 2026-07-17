-- GBM Intelligence — Histórico central de consultas CNPJ (aba Consulta)
-- Rode isto no Supabase: painel do projeto → SQL Editor → New query → cole e "Run".
-- Guarda toda consulta feita por qualquer usuário, para consulta pessoal E auditoria pelo Master.

create table if not exists consultas_cnpj (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references usuarios(id) on delete cascade,
  cnpj           text not null,
  razao_social   text,
  situacao       text,
  criado_em      timestamptz not null default now()
);

create index if not exists idx_consultas_usuario on consultas_cnpj(usuario_id, criado_em desc);
create index if not exists idx_consultas_data on consultas_cnpj(criado_em desc);

alter table consultas_cnpj enable row level security;
