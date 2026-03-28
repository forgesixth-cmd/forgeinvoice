import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../lib/supabase-admin";

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  const header = request.headers.get("authorization");
  return header === `Bearer ${cronSecret}`;
}

function buildReminderEmail(invoice, brandProfile) {
  const companyName = brandProfile?.companyName || "ForgeInvoice";
  const total = `${invoice.currency || "INR"} ${Number(
    invoice.total_amount ?? invoice.amount ?? 0
  ).toFixed(2)}`;

  return {
    subject: `Reminder: ${invoice.invoice_number} is due on ${invoice.due_date}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
        <h2 style="margin-bottom:8px;">Payment reminder for ${invoice.invoice_number}</h2>
        <p>Hello ${invoice.client_name || "there"},</p>
        <p>This is a friendly reminder that invoice <strong>${invoice.invoice_number}</strong> from <strong>${companyName}</strong> is due on <strong>${invoice.due_date}</strong>.</p>
        <p>Outstanding amount: <strong>${total}</strong></p>
        <p>${brandProfile?.paymentInstructions || "Please arrange payment at your earliest convenience."}</p>
        ${
          brandProfile?.bankDetails
            ? `<p><strong>Bank details:</strong><br />${brandProfile.bankDetails.replace(/\n/g, "<br />")}</p>`
            : ""
        }
        <p>Thank you,<br />${brandProfile?.signatoryName || companyName}</p>
      </div>
    `,
  };
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
    throw new Error(payload || "Unable to send reminder email.");
  }
}

export async function POST(request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { invoiceId, brandProfile } = body;
  const authClient = createSupabaseAuthClient();
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  if (!invoiceId || !accessToken || !authClient) {
    return NextResponse.json(
      { error: "Authorized reminder requests require a valid session." },
      { status: 401 }
    );
  }

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(accessToken);

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

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

  try {
    await sendEmail({
      to: invoice.client_email,
      ...buildReminderEmail(invoice, brandProfile),
    });

    await supabaseAdmin
      .from("invoices")
      .update({ last_reminder_sent_at: new Date().toISOString() })
      .eq("id", invoiceId)
      .eq("user_id", user.id);

    return NextResponse.json({
      message: `Reminder sent to ${invoice.client_email}.`,
    });
  } catch (sendError) {
    return NextResponse.json(
      { error: sendError.message || "Unable to send reminder." },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." },
      { status: 500 }
    );
  }

  const today = new Date();
  const soonDate = new Date(today);
  soonDate.setDate(soonDate.getDate() + 2);

  const { data, error } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .neq("status", "paid")
    .eq("reminder_enabled", true)
    .lte("due_date", soonDate.toISOString().split("T")[0]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sentCount = 0;

  for (const invoice of data || []) {
    if (!invoice.client_email) continue;

    const lastSent = invoice.last_reminder_sent_at
      ? new Date(invoice.last_reminder_sent_at)
      : null;

    if (lastSent && today.getTime() - lastSent.getTime() < 24 * 60 * 60 * 1000) {
      continue;
    }

    try {
      await sendEmail({
        to: invoice.client_email,
        ...buildReminderEmail(invoice, {}),
      });

      await supabaseAdmin
        .from("invoices")
        .update({
          last_reminder_sent_at: new Date().toISOString(),
          status:
            new Date(invoice.due_date).getTime() < today.getTime() &&
            invoice.status !== "paid"
              ? "overdue"
              : invoice.status,
        })
        .eq("id", invoice.id);

      sentCount += 1;
    } catch {
      continue;
    }
  }

  return NextResponse.json({ sentCount });
}
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
