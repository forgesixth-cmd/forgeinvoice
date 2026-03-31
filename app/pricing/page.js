"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const startFree = async () => {
    if (!supabase) return;

    setError("");
    setIsLoading(true);

    const { data, error: loginError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/pricing`,
        skipBrowserRedirect: true,
      },
    });

    setIsLoading(false);

    if (loginError) {
      setError(loginError.message || "Unable to start sign in.");
      return;
    }

    if (data?.url) {
      window.location.assign(data.url);
    }
  };

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[36px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.24),_transparent_28%),linear-gradient(135deg,_#fffdf7,_#eef4ff_58%,_#f8fafc)] p-8 shadow-[0_40px_120px_rgba(15,23,42,0.10)] sm:p-12">
          <p className="inline-flex rounded-full border border-slate-300/70 bg-white/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-slate-600">
            Pricing
          </p>
          <h1 className="mt-8 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-6xl">
            Create international invoices in 30 seconds and get paid faster.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Start free, create your first invoices, then unlock unlimited invoices and
            payment links with ForgeInvoice Pro.
          </p>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <article className="rounded-[32px] border border-slate-200/80 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Free</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Start free
            </h2>
            <p className="mt-3 text-slate-600">
              Perfect for testing the workflow and getting your first invoices out.
            </p>
            <p className="mt-8 text-5xl font-semibold text-slate-950">₹0</p>
            <ul className="mt-8 space-y-3 text-sm text-slate-700">
              <li>3 invoices total</li>
              <li>Premium PDF export</li>
              <li>Client management</li>
              <li>Email reminders</li>
            </ul>
            <button
              onClick={startFree}
              disabled={isLoading}
              className="mt-8 min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60"
            >
              {isLoading ? "Starting..." : "Start Free"}
            </button>
          </article>

          <article className="rounded-[32px] border border-slate-200/80 bg-slate-950 p-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
            <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Pro</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Unlimited invoices and payments
            </h2>
            <p className="mt-3 text-slate-300">
              Built for freelancers and agencies who want to convert invoices into revenue.
            </p>
            <p className="mt-8 text-5xl font-semibold">₹499/mo</p>
            <ul className="mt-8 space-y-3 text-sm text-slate-200">
              <li>Unlimited invoices</li>
              <li>Payment links inside invoices</li>
              <li>Recurring invoices</li>
              <li>Priority dashboard and growth tools</li>
            </ul>
            <Link
              href="/"
              className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
            >
              Upgrade from app
            </Link>
          </article>
        </section>

        {error ? (
          <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
