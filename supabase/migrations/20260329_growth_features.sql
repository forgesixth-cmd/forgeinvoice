create table if not exists public.clients (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  address text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clients_user_id_name_idx
on public.clients (user_id, name);

alter table public.clients enable row level security;

drop policy if exists "Users can view their own clients" on public.clients;
create policy "Users can view their own clients"
on public.clients
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own clients" on public.clients;
create policy "Users can insert their own clients"
on public.clients
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own clients" on public.clients;
create policy "Users can update their own clients"
on public.clients
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.invoices
add column if not exists client_phone text,
add column if not exists next_issue_date date,
add column if not exists recurring_enabled boolean default false,
add column if not exists recurring_frequency text default 'monthly',
add column if not exists payment_link text;

update public.invoices
set
  client_phone = coalesce(client_phone, ''),
  next_issue_date = coalesce(next_issue_date, due_date),
  recurring_enabled = coalesce(recurring_enabled, false),
  recurring_frequency = coalesce(recurring_frequency, 'monthly'),
  payment_link = coalesce(payment_link, '');
