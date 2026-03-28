alter table public.invoices
add column if not exists timezone text default 'Asia/Kolkata',
add column if not exists tax_enabled boolean default true,
add column if not exists tax_label text default 'Tax',
add column if not exists gst_enabled boolean default false,
add column if not exists reminder_enabled boolean default true,
add column if not exists last_reminder_sent_at timestamptz;

update public.invoices
set
  timezone = coalesce(timezone, 'Asia/Kolkata'),
  tax_enabled = coalesce(tax_enabled, true),
  tax_label = coalesce(tax_label, 'Tax'),
  gst_enabled = coalesce(gst_enabled, false),
  reminder_enabled = coalesce(reminder_enabled, true);
