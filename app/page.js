"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [user, setUser] = useState(null);
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState("");
  const [invoices, setInvoices] = useState([]);

useEffect(() => {
  const getUser = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      setUser(data.session.user);
      fetchInvoices(data.session.user.id);
    }
  };

  getUser();
}, []);

  const checkUser = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      setUser(data.user);
      fetchInvoices(data.user.id);
    }
  };

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
    });
  };

  useEffect(() => {
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
    await supabase.auth.signOut();
    setUser(null);
  };

  const saveInvoice = async () => {
    if (!client || !amount) return;

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

  const fetchInvoices = async (userId) => {
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    setInvoices(data);
  };

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <button
          onClick={login}
          className="bg-black text-white px-6 py-3 rounded-lg"
        >
          Login with Google
        </button>
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