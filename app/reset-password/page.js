"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const updatePassword = async (event) => {
    event.preventDefault();
    if (!supabase) return;

    setError("");
    setMessage("");

    if (!password || !confirmPassword) {
      setError("Enter your new password in both fields.");
      return;
    }

    if (password.length < 6) {
      setError("Use at least 6 characters for your new password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password and confirm password must match.");
      return;
    }

    setIsSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSaving(false);

    if (updateError) {
      setError(
        updateError.message ||
          "Unable to update your password. Open the reset link from your email and try again."
      );
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setMessage("Password updated. You can now sign in with your new password.");
  };

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl rounded-[36px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_30%),linear-gradient(135deg,_#fffdf7,_#eef4ff_58%,_#f8fafc)] p-8 shadow-[0_40px_120px_rgba(15,23,42,0.10)] sm:p-12">
        <p className="inline-flex rounded-full border border-slate-300/70 bg-white/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-slate-600">
          Password reset
        </p>
        <h1 className="mt-8 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
          Choose a new password
        </h1>
        <p className="mt-4 text-base leading-8 text-slate-600">
          Open this page from the reset link sent to your email, then save your new
          password below.
        </p>

        <form onSubmit={updatePassword} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              New password
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              placeholder="Enter your new password"
              autoComplete="new-password"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Reconfirm password
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              placeholder="Enter your new password again"
              autoComplete="new-password"
            />
          </label>

          <button
            type="submit"
            disabled={isSaving}
            className="min-h-12 w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {isSaving ? "Updating password..." : "Submit"}
          </button>
        </form>

        {message ? (
          <p className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <Link
          href="/"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Back to app
        </Link>
      </div>
    </main>
  );
}
