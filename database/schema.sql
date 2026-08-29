-- ============================================================
-- Calculoco — Schema do banco de dados (Supabase / PostgreSQL)
-- Rode este script no SQL Editor do seu projeto Supabase.
-- ============================================================

create extension if not exists "pgcrypto";

-- Turmas cadastradas pelo professor. Cada turma tem um código
-- numérico de 4 dígitos que os alunos usam para entrar.
create table if not exists turmas (
  id uuid primary key default gen_random_uuid(),
  codigo varchar(4) unique not null,
  nome_turma text not null,
  nome_professor text not null,
  criado_em timestamptz not null default now()
);

-- Alunos vinculados a uma turma. O PIN nunca é salvo em texto puro,
-- apenas o hash (bcrypt) gerado pelo backend.
create table if not exists alunos (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references turmas(id) on delete cascade,
  nome_usuario text not null,
  pin_hash text not null,
  criado_em timestamptz not null default now(),
  unique (turma_id, nome_usuario)
);

-- Progresso do aluno por fase. Uma linha por (aluno, fase).
create table if not exists progresso (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references alunos(id) on delete cascade,
  fase_numero integer not null,
  concluida boolean not null default false,
  acertos integer not null default 0,
  erros integer not null default 0,
  atualizado_em timestamptz not null default now(),
  unique (aluno_id, fase_numero)
);

create index if not exists idx_alunos_turma on alunos (turma_id);
create index if not exists idx_progresso_aluno on progresso (aluno_id);

-- Observação sobre segurança:
-- O backend usa a Service Role Key do Supabase (nunca exposta ao navegador),
-- então o Row Level Security pode ficar habilitado nas tabelas acima
-- sem policies — apenas o backend confiável terá acesso, o que já
-- é suficiente para este projeto (sem acesso direto do cliente ao banco).
alter table turmas enable row level security;
alter table alunos enable row level security;
alter table progresso enable row level security;
