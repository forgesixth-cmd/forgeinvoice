"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [authMessage, setAuthMessage] = useState("");
  const [error, setError] = useState("");

  const startFree = async () => {
    if (!supabase) return;

    setError("");
    setAuthMessage("");
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

  const updateAuthField = (field, value) => {
    setAuthForm((current) => ({ ...current, [field]: value }));
  };

  const submitEmailAuth = async (event) => {
    event.preventDefault();
    if (!supabase) return;

    const email = authForm.email.trim();
    const password = authForm.password;
    const confirmPassword = authForm.confirmPassword;

    setError("");
    setAuthMessage("");

    if (!email || !password) {
      setError("Enter both your email address and password.");
      return;
    }

    setIsLoading(true);

    if (authMode === "signup") {
      if (password.length < 6) {
        setIsLoading(false);
        setError("Use at least 6 characters for your password.");
        return;
      }

      if (password !== confirmPassword) {
        setIsLoading(false);
        setError("Password and confirm password must match.");
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/pricing`,
        },
      });

      setIsLoading(false);

      if (signUpError) {
        setError(signUpError.message || "Unable to create your account.");
        return;
      }

      setAuthForm({ email, password: "", confirmPassword: "" });
      setAuthMessage(
        "Account created. If email confirmation is enabled in Supabase, confirm your email before signing in."
      );
      setAuthMode("signin");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (signInError) {
      setError(signInError.message || "Unable to sign in with email and password.");
      return;
    }

    window.location.assign("/");
  };

  const sendPasswordReset = async () => {
    if (!supabase) return;

    const email = authForm.email.trim();
    setError("");
    setAuthMessage("");

    if (!email) {
      setError("Enter your email address first, then request the reset link.");
      return;
    }

    setIsLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setIsLoading(false);

    if (resetError) {
      setError(resetError.message || "Unable to send the reset email.");
      return;
    }

    setAuthMessage("Password reset email sent. Open the link in your inbox to choose a new password.");
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

        <section className="mt-6 rounded-[32px] border border-slate-200/80 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-10">
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Access</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Sign in, register, or reset your password
            </h2>
            <p className="mt-3 text-slate-600">
              Use Google if you want the fastest path, or create an email/password account
              for reviewer-friendly access.
            </p>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white">
              <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Google</p>
              <h3 className="mt-3 text-2xl font-semibold">One-tap access</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Great for your own workflow. Sessions stay persistent after login.
              </p>
              <button
                onClick={startFree}
                disabled={isLoading}
                className="mt-8 min-h-12 w-full rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-100 disabled:opacity-60"
              >
                {isLoading ? "Starting..." : "Continue with Google"}
              </button>
            </div>

            <div>
              <div className="grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setError("");
                    setAuthMessage("");
                  }}
                  className={`min-h-11 rounded-[14px] px-4 text-sm font-medium transition ${
                    authMode === "signin"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setError("");
                    setAuthMessage("");
                  }}
                  className={`min-h-11 rounded-[14px] px-4 text-sm font-medium transition ${
                    authMode === "signup"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Register
                </button>
              </div>

              <form onSubmit={submitEmailAuth} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Email ID
                  </span>
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={(event) => updateAuthField("email", event.target.value)}
                    className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Password
                  </span>
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={(event) => updateAuthField("password", event.target.value)}
                    className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    placeholder="Enter your password"
                    autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                  />
                </label>

                {authMode === "signup" ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Reconfirm password
                    </span>
                    <input
                      type="password"
                      value={authForm.confirmPassword}
                      onChange={(event) =>
                        updateAuthField("confirmPassword", event.target.value)
                      }
                      className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                      placeholder="Enter your password again"
                      autoComplete="new-password"
                    />
                  </label>
                ) : null}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="min-h-12 w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {isLoading
                    ? authMode === "signup"
                      ? "Creating account..."
                      : "Signing in..."
                    : authMode === "signup"
                      ? "Submit"
                      : "Login"}
                </button>
              </form>

              <button
                type="button"
                onClick={sendPasswordReset}
                disabled={isLoading}
                className="mt-4 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-900"
              >
                Forgot password? Reset it
              </button>
            </div>
          </div>
        </section>

        {authMessage ? (
          <p className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {authMessage}
          </p>
        ) : null}

        {error ? (
          <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
