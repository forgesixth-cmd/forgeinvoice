alter table public.invoices
add column if not exists invoice_number text,
add column if not exists client_name text,
add column if not exists client_email text,
add column if not exists client_address text,
add column if not exists issue_date date,
add column if not exists due_date date,
add column if not exists status text default 'draft',
add column if not exists currency text default 'INR',
add column if not exists tax_rate numeric default 0,
add column if not exists subtotal numeric default 0,
add column if not exists tax_amount numeric default 0,
add column if not exists total_amount numeric default 0,
add column if not exists notes text,
add column if not exists items jsonb default '[]'::jsonb;

update public.invoices
set
  client_name = coalesce(client_name, client),
  invoice_number = coalesce(invoice_number, 'INV-' || id::text),
  issue_date = coalesce(issue_date, created_at::date),
  status = coalesce(status, 'draft'),
  currency = coalesce(currency, 'INR'),
  tax_rate = coalesce(tax_rate, 0),
  subtotal = coalesce(subtotal, amount, 0),
  tax_amount = coalesce(tax_amount, 0),
  total_amount = coalesce(total_amount, amount, 0),
  items = case
    when jsonb_array_length(coalesce(items, '[]'::jsonb)) > 0 then items
    else jsonb_build_array(
      jsonb_build_object(
        'description', coalesce(client, 'Invoice item'),
        'quantity', 1,
        'rate', coalesce(amount, 0)
      )
    )
  end;
