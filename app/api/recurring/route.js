import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

function addFrequency(dateString, frequency) {
  const date = new Date(`${dateString}T00:00:00.000Z`);

  if (frequency === "weekly") {
    date.setDate(date.getDate() + 7);
  } else if (frequency === "quarterly") {
    date.setMonth(date.getMonth() + 3);
  } else {
    date.setMonth(date.getMonth() + 1);
  }

  return date.toISOString().split("T")[0];
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

  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("recurring_enabled", true)
    .lte("next_issue_date", today);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let generated = 0;

  for (const invoice of data || []) {
    const nextIssueDate = addFrequency(
      invoice.next_issue_date || today,
      invoice.recurring_frequency || "monthly"
    );
    const nextDueDate = addFrequency(
      invoice.due_date || invoice.next_issue_date || today,
      invoice.recurring_frequency || "monthly"
    );

    const newInvoice = {
      ...invoice,
      id: undefined,
      created_at: undefined,
      updated_at: undefined,
      invoice_number: `${invoice.invoice_number}-${nextIssueDate.replaceAll("-", "")}`,
      issue_date: invoice.next_issue_date || today,
      due_date: nextDueDate,
      next_issue_date: nextIssueDate,
      status: "draft",
      last_reminder_sent_at: null,
    };

    await supabaseAdmin.from("invoices").insert([newInvoice]);
    await supabaseAdmin
      .from("invoices")
      .update({ next_issue_date: nextIssueDate })
      .eq("id", invoice.id);

    generated += 1;
  }

  return NextResponse.json({ generated });
}
