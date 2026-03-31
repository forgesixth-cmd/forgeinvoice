import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../lib/supabase-admin";

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

async function sendEmail({ to, subject, html }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.REMINDER_FROM_EMAIL || "ForgeInvoice <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || "Unable to send invoice email.");
  }
}

export async function POST(request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." },
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

  const body = await request.json();
  const { invoiceId, subject, message, brandProfile } = body;

  const { data: invoice, error } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  if (!invoice.client_email) {
    return NextResponse.json(
      { error: "This invoice does not have a client email address." },
      { status: 400 }
    );
  }

  const publicInvoiceUrl = invoice.public_slug
    ? `${request.nextUrl.origin}/invoice/${invoice.public_slug}`
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
      <h2 style="margin-bottom:8px;">${subject}</h2>
      <p>${message.replace(/\n/g, "<br />")}</p>
      <p><strong>Invoice:</strong> ${invoice.invoice_number}</p>
      <p><strong>Amount:</strong> ${invoice.currency || "INR"} ${Number(
        invoice.total_amount ?? invoice.amount ?? 0
      ).toFixed(2)}</p>
      ${
        invoice.payment_link
          ? `<p><a href="${invoice.payment_link}" style="display:inline-block;padding:12px 18px;background:#0f172a;color:#fff;border-radius:12px;text-decoration:none;">Pay Now</a></p>`
          : ""
      }
      ${
        publicInvoiceUrl
          ? `<p><a href="${publicInvoiceUrl}" style="display:inline-block;padding:12px 18px;border:1px solid #cbd5e1;color:#0f172a;border-radius:12px;text-decoration:none;">View invoice online</a></p>`
          : ""
      }
      <p>Sent by ${brandProfile?.companyName || "ForgeInvoice"}.</p>
    </div>
  `;

  try {
    await sendEmail({
      to: invoice.client_email,
      subject,
      html,
    });

    return NextResponse.json({
      message: `Invoice emailed to ${invoice.client_email}.`,
    });
  } catch (sendError) {
    return NextResponse.json(
      { error: sendError.message || "Unable to send invoice." },
      { status: 500 }
    );
  }
}
