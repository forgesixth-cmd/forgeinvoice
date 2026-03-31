import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "../../../lib/supabase-admin";

function formatCurrency(value, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value, timeZone = "UTC") {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function normalizeInvoice(invoice) {
  const items =
    Array.isArray(invoice.items) && invoice.items.length > 0
      ? invoice.items
      : [
          {
            description: invoice.client_name || invoice.client || "Invoice item",
            quantity: 1,
            rate: invoice.total_amount ?? invoice.amount ?? 0,
          },
        ];

  return {
    ...invoice,
    client_name: invoice.client_name || invoice.client || "Client",
    client_email: invoice.client_email || "",
    client_address: invoice.client_address || "",
    client_phone: invoice.client_phone || "",
    invoice_number: invoice.invoice_number || `INV-${invoice.id}`,
    currency: invoice.currency || "INR",
    timezone: invoice.timezone || "Asia/Kolkata",
    status: invoice.status || "draft",
    tax_enabled: typeof invoice.tax_enabled === "boolean" ? invoice.tax_enabled : true,
    tax_label: invoice.gst_enabled ? "GST" : invoice.tax_label || "Tax",
    subtotal: Number(invoice.subtotal ?? invoice.amount ?? invoice.total_amount ?? 0),
    tax_amount: Number(invoice.tax_amount ?? 0),
    total_amount: Number(invoice.total_amount ?? invoice.amount ?? 0),
    notes: invoice.notes || "",
    items,
    payment_link: invoice.payment_link || "",
  };
}

export async function generateMetadata({ params }) {
  return {
    title: `Invoice ${params.slug} | ForgeInvoice`,
  };
}

export default async function PublicInvoicePage({ params }) {
  if (!supabaseAdmin) {
    notFound();
  }

  const { data: invoice, error } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("public_slug", params.slug)
    .single();

  if (error || !invoice) {
    notFound();
  }

  const normalized = normalizeInvoice(invoice);

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <section className="overflow-hidden rounded-[36px] border border-slate-200/80 bg-[linear-gradient(135deg,_rgba(255,255,255,0.94),_rgba(247,250,255,0.98)_45%,_rgba(255,248,235,0.98))] shadow-[0_40px_120px_rgba(15,23,42,0.10)]">
          <div className="bg-slate-950 px-8 py-10 text-white sm:px-10">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">ForgeInvoice</p>
            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-semibold tracking-tight">
                  {normalized.invoice_number}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                  A shareable invoice page your client can open without logging in.
                </p>
              </div>
              <div className="rounded-3xl bg-white/8 px-5 py-4 text-sm">
                <p className="text-slate-400">Invoice total</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {formatCurrency(normalized.total_amount, normalized.currency)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-8 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10">
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Bill To
                  </p>
                  <h2 className="mt-3 text-xl font-semibold text-slate-950">
                    {normalized.client_name}
                  </h2>
                  {normalized.client_email ? (
                    <p className="mt-2 text-sm text-slate-600">{normalized.client_email}</p>
                  ) : null}
                  {normalized.client_phone ? (
                    <p className="mt-1 text-sm text-slate-600">{normalized.client_phone}</p>
                  ) : null}
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {normalized.client_address || "Billing address not added yet."}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Timeline
                  </p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Issued</span>
                      <span className="font-medium text-slate-950">
                        {formatDate(normalized.issue_date, normalized.timezone)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Due</span>
                      <span className="font-medium text-slate-950">
                        {formatDate(normalized.due_date, normalized.timezone)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Status</span>
                      <span className="font-medium uppercase text-slate-950">
                        {normalized.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="grid grid-cols-[1.4fr_0.3fr_0.6fr_0.6fr] gap-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <span>Description</span>
                  <span>Qty</span>
                  <span className="text-right">Rate</span>
                  <span className="text-right">Amount</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {normalized.items.map((item, index) => {
                    const quantity = Number(item.quantity || 0);
                    const rate = Number(item.rate || 0);
                    const lineTotal = quantity * rate;

                    return (
                      <div
                        key={`${item.description}-${index}`}
                        className="grid grid-cols-[1.4fr_0.3fr_0.6fr_0.6fr] gap-4 px-4 py-4 text-sm text-slate-700"
                      >
                        <span className="font-medium text-slate-950">
                          {item.description || "Untitled item"}
                        </span>
                        <span>{quantity}</span>
                        <span className="text-right">
                          {formatCurrency(rate, normalized.currency)}
                        </span>
                        <span className="text-right font-medium text-slate-950">
                          {formatCurrency(lineTotal, normalized.currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {normalized.notes ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Notes
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{normalized.notes}</p>
                </div>
              ) : null}
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Summary
                </p>
                <div className="mt-5 space-y-4 text-sm">
                  <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <span className="text-slate-400">Subtotal</span>
                    <span className="font-medium text-white">
                      {formatCurrency(normalized.subtotal, normalized.currency)}
                    </span>
                  </div>
                  {normalized.tax_enabled ? (
                    <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                      <span className="text-slate-400">{normalized.tax_label}</span>
                      <span className="font-medium text-white">
                        {formatCurrency(normalized.tax_amount, normalized.currency)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-400">Total</span>
                    <span className="text-2xl font-semibold text-white">
                      {formatCurrency(normalized.total_amount, normalized.currency)}
                    </span>
                  </div>
                </div>

                {normalized.payment_link ? (
                  <a
                    href={normalized.payment_link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
                  >
                    Pay now
                  </a>
                ) : null}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Powered by
                </p>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">ForgeInvoice</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Professional, shareable invoices with payment links and clean client access.
                </p>
                <Link
                  href="/"
                  className="mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Create your own invoice
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
