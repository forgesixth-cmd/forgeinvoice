alter table public.invoices
add column if not exists public_slug text;

update public.invoices
set public_slug = substring(md5(random()::text || clock_timestamp()::text) for 12)
where public_slug is null;

alter table public.invoices
alter column public_slug set not null;

create unique index if not exists invoices_public_slug_key
on public.invoices (public_slug);
