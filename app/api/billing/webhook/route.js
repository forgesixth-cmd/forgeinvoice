import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

function verifySignature(body, signature, secret) {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return expected === signature;
}

export async function POST(request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!supabaseAdmin || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook environment variables are not configured." },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature || !verifySignature(body, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const payload = JSON.parse(body);
  const subscription = payload.payload?.subscription?.entity;
  const subscriptionId = subscription?.id;

  if (!subscriptionId) {
    return NextResponse.json({ received: true });
  }

  const event = payload.event;
  const nextStatusMap = {
    "subscription.activated": "active",
    "subscription.charged": "active",
    "subscription.pending": "pending",
    "subscription.halted": "past_due",
    "subscription.cancelled": "cancelled",
    "subscription.completed": "expired",
  };

  const status = nextStatusMap[event] || "pending";

  await supabaseAdmin
    .from("subscriptions")
    .update({
      plan: status === "active" ? "pro" : "free",
      status,
      provider: "razorpay",
      provider_customer_id: subscription.customer_id || null,
      current_period_end: subscription.current_end
        ? new Date(subscription.current_end * 1000).toISOString()
        : null,
    })
    .eq("provider_subscription_id", subscriptionId);

  return NextResponse.json({ received: true });
}
