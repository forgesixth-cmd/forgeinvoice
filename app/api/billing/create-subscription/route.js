import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

function createSupabaseAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request) {
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
  const razorpayPlanId = process.env.RAZORPAY_PLAN_ID;

  if (!supabaseAdmin || !razorpayKeyId || !razorpayKeySecret || !razorpayPlanId) {
    return NextResponse.json(
      { error: "Billing environment variables are not configured." },
      { status: 500 }
    );
  }

  const authClient = createSupabaseAuthClient();
  const accessToken = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!authClient || !accessToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(accessToken);

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: razorpayPlanId,
      total_count: 120,
      customer_notify: 1,
      notes: {
        user_id: user.id,
        email: user.email || "",
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    return NextResponse.json(
      { error: payload.error?.description || "Unable to create Razorpay subscription." },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("subscriptions").upsert(
    [
      {
        user_id: user.id,
        provider: "razorpay",
        provider_subscription_id: payload.id,
        plan: "pro",
        status: "pending",
      },
    ],
    { onConflict: "user_id" }
  );

  return NextResponse.json({
    keyId: razorpayKeyId,
    subscriptionId: payload.id,
  });
}
