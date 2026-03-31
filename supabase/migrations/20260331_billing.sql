create table if not exists public.subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  provider text default 'razorpay',
  provider_customer_id text,
  provider_subscription_id text,
  plan text not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "Users can view their own subscriptions" on public.subscriptions;
create policy "Users can view their own subscriptions"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own subscriptions" on public.subscriptions;
create policy "Users can insert their own subscriptions"
on public.subscriptions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own subscriptions" on public.subscriptions;
create policy "Users can update their own subscriptions"
on public.subscriptions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
