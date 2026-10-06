-- Хомягочи: облачная синхронизация через Supabase
-- Выполни в SQL Editor своего проекта Supabase

create table if not exists public.saves (
  user_id uuid not null default auth.uid() primary key,
  data jsonb not null,
  version int not null default 2,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

-- Пользователь видит и пишет только своё сохранение
create policy "own save select" on public.saves
  for select using (auth.uid() = user_id);

create policy "own save upsert" on public.saves
  for insert with check (auth.uid() = user_id);

create policy "own save update" on public.saves
  for update using (auth.uid() = user_id);

-- Автообновление метки времени
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists saves_updated_at on public.saves;
create trigger saves_updated_at
  before update on public.saves
  for each row execute function public.set_updated_at();
