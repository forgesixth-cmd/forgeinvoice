"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [user, setUser] = useState(null);
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const configError = !supabase
    ? "Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel project settings."
    : "";

  async function fetchInvoices(userId) {
    if (!supabase) return;

    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    setInvoices(data);
  }

  useEffect(() => {
    if (!supabase) return;

    const getUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setUser(data.session.user);
        fetchInvoices(data.session.user.id);
      }
    };

    getUser();
  }, []);

  const login = async () => {
    if (!supabase) return;

    setLoginError("");
    setIsLoggingIn(true);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        skipBrowserRedirect: true,
      },
    });

    setIsLoggingIn(false);

    if (error) {
      if (error.message?.toLowerCase().includes("provider is not enabled")) {
        setLoginError(
          "Google login is not enabled in Supabase yet. In your Supabase dashboard, open Authentication > Providers > Google, enable it, and add this site URL as an allowed redirect."
        );
        return;
      }

      setLoginError(error.message || "Unable to start login. Please try again.");
      return;
    }

    if (data?.url) {
      window.location.assign(data.url);
      return;
    }

    setLoginError("Unable to start login. Please verify your Supabase auth settings.");
  };

  useEffect(() => {
    if (!supabase) return;

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          fetchInvoices(session.user.id);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const logout = async () => {
    if (!supabase) return;

    await supabase.auth.signOut();
    setUser(null);
  };

  const saveInvoice = async () => {
    if (!supabase || !user || !client || !amount) return;

    await supabase.from("invoices").insert([
      {
        user_id: user.id,
        client,
        amount,
      },
    ]);

    fetchInvoices(user.id);
    setClient("");
    setAmount("");
  };

  if (configError) {
    return (
      <div className="h-screen flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-bold mb-3">ForgeInvoice</h1>
          <p className="text-red-600">{configError}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <button
            onClick={login}
            disabled={isLoggingIn}
            className="bg-black text-white px-6 py-3 rounded-lg disabled:opacity-60"
          >
            {isLoggingIn ? "Starting login..." : "Login with Google"}
          </button>

          {loginError ? (
            <p className="mt-4 text-sm text-red-600">{loginError}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex justify-between mb-4">
        <h1 className="text-xl font-bold">ForgeInvoice</h1>
        <button onClick={logout}>Logout</button>
      </div>

      <input
        className="w-full border p-2 mb-3"
        placeholder="Client"
        value={client}
        onChange={(e) => setClient(e.target.value)}
      />

      <input
        className="w-full border p-2 mb-3"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <button
        onClick={saveInvoice}
        className="w-full bg-black text-white p-2 mb-6"
      >
        Save Invoice
      </button>

      <h2 className="font-semibold mb-2">Your Invoices</h2>

      {invoices.map((inv) => (
        <div key={inv.id} className="border p-3 mb-2 rounded">
          <p>{inv.client}</p>
          <p>₹{inv.amount}</p>
        </div>
      ))}
    </div>
  );
}
