"use client";

import Image from "next/image";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { supabase } from "../lib/supabase";

const STATUS_STYLES = {
  draft: "bg-amber-100 text-amber-800",
  pending: "bg-sky-100 text-sky-800",
  paid: "bg-emerald-100 text-emerald-800",
  overdue: "bg-rose-100 text-rose-800",
};

const INVOICE_FILTERS = ["all", "draft", "pending", "paid", "overdue"];

const TIMEZONE_OPTIONS = [
  "Asia/Kolkata",
  "UTC",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
];

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

function getFutureDateString(daysAhead) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split("T")[0];
}

function createInvoiceNumber() {
  return `INV-${Date.now().toString().slice(-6)}`;
}

function createEmptyItem() {
  return { description: "", quantity: "1", rate: "0" };
}

function createInitialForm() {
  return {
    invoiceNumber: createInvoiceNumber(),
    clientName: "",
    clientEmail: "",
    clientAddress: "",
    clientPhone: "",
    issueDate: getTodayDateString(),
    dueDate: getFutureDateString(14),
    nextIssueDate: getFutureDateString(30),
    status: "draft",
    currency: "INR",
    timezone: "Asia/Kolkata",
    taxEnabled: true,
    taxLabel: "Tax",
    taxRate: "18",
    gstEnabled: false,
    reminderEnabled: true,
    recurringEnabled: false,
    recurringFrequency: "monthly",
    paymentLink: "",
    notes: "",
    items: [createEmptyItem()],
  };
}

function createBrandProfile(accountEmail = "") {
  return {
    companyName: "ForgeInvoice Studio",
    companyEmail: accountEmail,
    companyAddress: "",
    logoDataUrl: "",
    paymentInstructions:
      "Please make payment within the due date mentioned on this invoice.",
    bankDetails: "",
    signatoryName: "",
    footerNote: "Thank you for your business.",
    gstNumber: "",
  };
}

function safeString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeFormData(form) {
  const base = createInitialForm();
  const incoming = form || {};
  const items =
    Array.isArray(incoming.items) && incoming.items.length > 0
      ? incoming.items.map((item) => ({
          description: safeString(item?.description),
          quantity: safeString(item?.quantity, "1"),
          rate: safeString(item?.rate, "0"),
        }))
      : base.items;

  return {
    ...base,
    ...incoming,
    invoiceNumber: safeString(incoming.invoiceNumber, base.invoiceNumber),
    clientName: safeString(incoming.clientName),
    clientEmail: safeString(incoming.clientEmail),
    clientAddress: safeString(incoming.clientAddress),
    clientPhone: safeString(incoming.clientPhone),
    issueDate: safeString(incoming.issueDate, base.issueDate),
    dueDate: safeString(incoming.dueDate, base.dueDate),
    nextIssueDate: safeString(incoming.nextIssueDate, base.nextIssueDate),
    status: safeString(incoming.status, base.status),
    currency: safeString(incoming.currency, base.currency),
    timezone: safeString(incoming.timezone, base.timezone),
    taxEnabled:
      typeof incoming.taxEnabled === "boolean"
        ? incoming.taxEnabled
        : base.taxEnabled,
    taxLabel: safeString(incoming.taxLabel, base.taxLabel),
    taxRate: safeString(incoming.taxRate, base.taxRate),
    gstEnabled:
      typeof incoming.gstEnabled === "boolean"
        ? incoming.gstEnabled
        : base.gstEnabled,
    reminderEnabled:
      typeof incoming.reminderEnabled === "boolean"
        ? incoming.reminderEnabled
        : base.reminderEnabled,
    recurringEnabled:
      typeof incoming.recurringEnabled === "boolean"
        ? incoming.recurringEnabled
        : base.recurringEnabled,
    recurringFrequency: safeString(
      incoming.recurringFrequency,
      base.recurringFrequency
    ),
    paymentLink: safeString(incoming.paymentLink),
    notes: safeString(incoming.notes),
    items,
  };
}

function normalizeBrandProfileData(profile, accountEmail = "") {
  const base = createBrandProfile(accountEmail);
  const incoming = profile || {};

  return {
    ...base,
    ...incoming,
    companyName: safeString(incoming.companyName, base.companyName),
    companyEmail: safeString(incoming.companyEmail, base.companyEmail),
    companyAddress: safeString(incoming.companyAddress),
    logoDataUrl: safeString(incoming.logoDataUrl),
    paymentInstructions: safeString(
      incoming.paymentInstructions,
      base.paymentInstructions
    ),
    bankDetails: safeString(incoming.bankDetails),
    signatoryName: safeString(incoming.signatoryName),
    footerNote: safeString(incoming.footerNote, base.footerNote),
    gstNumber: safeString(incoming.gstNumber),
  };
}

function getDraftStorageKey(userId) {
  return `forgeinvoice:draft:${userId}`;
}

function getBrandStorageKey(userId) {
  return `forgeinvoice:brand:${userId}`;
}

function formatCurrency(value, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatCurrencyAmount(value) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatPdfMoney(value, currency = "INR") {
  return `${currency} ${formatCurrencyAmount(value)}`;
}

function formatDate(value, timeZone = "UTC") {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function formatDateTime(value, timeZone = "UTC") {
  if (!value) return "";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

function summarizeTotalsByCurrency(invoices) {
  const totals = invoices.reduce((accumulator, invoice) => {
    const currency = invoice.currency || "INR";
    const amount = Number(invoice.total_amount ?? invoice.amount ?? 0);
    accumulator[currency] = (accumulator[currency] || 0) + amount;
    return accumulator;
  }, {});

  const entries = Object.entries(totals);
  if (entries.length === 0) return "No invoices yet";

  return entries
    .map(([currency, value]) => formatCurrency(value, currency))
    .join(" • ");
}

function buildMonthlyRevenueData(invoices) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: date.toLocaleString("en-IN", { month: "short" }),
      paid: 0,
      pending: 0,
    };
  });

  const byKey = Object.fromEntries(months.map((month) => [month.key, month]));

  invoices.forEach((invoice) => {
    const sourceDate = invoice.issue_date || invoice.created_at;
    if (!sourceDate) return;

    const date = new Date(sourceDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!byKey[key]) return;

    const amount = Number(invoice.total_amount ?? invoice.amount ?? 0);
    if (invoice.status === "paid") {
      byKey[key].paid += amount;
    } else {
      byKey[key].pending += amount;
    }
  });

  return months;
}

function getClientRecord(invoice) {
  const normalized = normalizeInvoice(invoice);
  return {
    name: normalized.client_name,
    email: normalized.client_email,
    address: normalized.client_address,
    phone: normalized.client_phone,
  };
}

function normalizeInvoice(inv) {
  const items =
    Array.isArray(inv.items) && inv.items.length > 0
      ? inv.items
      : [
          {
            description: inv.project_description || inv.client || "Invoice item",
            quantity: 1,
            rate: inv.total_amount ?? inv.amount ?? 0,
          },
        ];

  return {
    ...inv,
    invoice_number: inv.invoice_number || `INV-${inv.id}`,
    client_name: inv.client_name || inv.client || "Untitled client",
    client_email: inv.client_email || "",
    client_address: inv.client_address || "",
    client_phone: inv.client_phone || "",
    issue_date: inv.issue_date || inv.created_at?.split("T")[0] || "",
    due_date: inv.due_date || "",
    next_issue_date: inv.next_issue_date || "",
    status: inv.status === "sent" ? "pending" : inv.status || "draft",
    currency: inv.currency || "INR",
    timezone: inv.timezone || "Asia/Kolkata",
    tax_enabled:
      typeof inv.tax_enabled === "boolean" ? inv.tax_enabled : true,
    tax_label: inv.tax_label || "Tax",
    tax_rate: Number(inv.tax_rate ?? 0),
    gst_enabled:
      typeof inv.gst_enabled === "boolean" ? inv.gst_enabled : false,
    reminder_enabled:
      typeof inv.reminder_enabled === "boolean" ? inv.reminder_enabled : true,
    recurring_enabled:
      typeof inv.recurring_enabled === "boolean" ? inv.recurring_enabled : false,
    recurring_frequency: inv.recurring_frequency || "monthly",
    subtotal: Number(inv.subtotal ?? inv.amount ?? inv.total_amount ?? 0),
    tax_amount: Number(inv.tax_amount ?? 0),
    total_amount: Number(inv.total_amount ?? inv.amount ?? 0),
    notes: inv.notes || "",
    items,
    last_reminder_sent_at: inv.last_reminder_sent_at || null,
    payment_link: inv.payment_link || "",
  };
}

function invoiceToForm(invoice) {
  const normalized = normalizeInvoice(invoice);

  return normalizeFormData({
    invoiceNumber: normalized.invoice_number,
    clientName: normalized.client_name,
    clientEmail: normalized.client_email,
    clientAddress: normalized.client_address,
    clientPhone: normalized.client_phone,
    issueDate: normalized.issue_date || getTodayDateString(),
    dueDate: normalized.due_date || getFutureDateString(14),
    nextIssueDate: normalized.next_issue_date || getFutureDateString(30),
    status: normalized.status,
    currency: normalized.currency,
    timezone: normalized.timezone,
    taxEnabled: normalized.tax_enabled,
    taxLabel: normalized.tax_label,
    taxRate: String(normalized.tax_rate ?? 0),
    gstEnabled: normalized.gst_enabled,
    reminderEnabled: normalized.reminder_enabled,
    recurringEnabled: normalized.recurring_enabled,
    recurringFrequency: normalized.recurring_frequency,
    paymentLink: normalized.payment_link,
    notes: normalized.notes || "",
    items:
      normalized.items.map((item) => ({
        description: item.description || "",
        quantity: String(item.quantity ?? 1),
        rate: String(item.rate ?? 0),
      })) || [createEmptyItem()],
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read logo file."));
    reader.readAsDataURL(file);
  });
}

function buildWhatsAppText(invoice, brandProfile) {
  const normalized = normalizeInvoice(invoice);
  const lines = [
    `${brandProfile.companyName || "ForgeInvoice"} invoice ${normalized.invoice_number}`,
    `Client: ${normalized.client_name}`,
    `Amount: ${formatCurrency(normalized.total_amount, normalized.currency)}`,
    `Due: ${formatDate(normalized.due_date, normalized.timezone)}`,
    brandProfile.paymentInstructions || "",
  ].filter(Boolean);

  return lines.join("\n");
}

async function downloadInvoicePdf(invoice, brandProfile, accountEmail) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const normalized = normalizeInvoice(invoice);
  const brand = brandProfile || createBrandProfile(accountEmail);
  let y = 56;
  const leftX = 44;
  const rightX = 551;
  const quantityX = 360;
  const rateX = 450;
  const amountX = 551;
  const summaryBoxX = 334;
  const summaryBoxWidth = 217;
  const pageBottom = 770;
  const taxLabel = normalized.gst_enabled ? "GST" : normalized.tax_label;

  pdf.setFillColor(22, 33, 62);
  pdf.rect(0, 0, 595, 120, "F");

  if (brand.logoDataUrl) {
    const imageFormat = brand.logoDataUrl.includes("image/jpeg") ? "JPEG" : "PNG";
    pdf.addImage(brand.logoDataUrl, imageFormat, 470, 28, 72, 72);
  }

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  pdf.text(brand.companyName || "ForgeInvoice", 44, 56);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Prepared by ${brand.companyEmail || accountEmail || "your team"}`, 44, 78);
  if (brand.companyAddress) {
    pdf.text(brand.companyAddress, 44, 96, { maxWidth: 320 });
  }

  pdf.setTextColor(32, 41, 67);
  y = 160;
  pdf.setFontSize(13);
  pdf.setFont("helvetica", "bold");
  pdf.text(`Invoice ${normalized.invoice_number}`, 44, y);
  y += 28;

  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(leftX, y - 18, 240, 104, 12, 12, "F");
  pdf.roundedRect(312, y - 18, 239, 104, 12, 12, "F");
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(leftX, y - 18, 240, 104, 12, 12);
  pdf.roundedRect(312, y - 18, 239, 104, 12, 12);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("From", 60, y);
  pdf.text("Bill To", 328, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text(brand.companyName || "ForgeInvoice", 60, y + 22);
  pdf.text(
    brand.companyAddress || "Add your sender address in the brand profile.",
    60,
    y + 40,
    { maxWidth: 200 }
  );
  pdf.text(brand.companyEmail || accountEmail || "your-team@example.com", 60, y + 78);
  pdf.text(normalized.client_name, 328, y + 22);
  pdf.text(
    normalized.client_address || "Add the client billing address in the invoice form.",
    328,
    y + 40,
    { maxWidth: 190 }
  );
  if (normalized.client_email) {
    pdf.text(normalized.client_email, 328, y + 78);
  }

  y += 124;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("Issue Date", 44, y);
  pdf.text("Due Date", 170, y);
  pdf.text("Status", 296, y);
  pdf.text("Timezone", 408, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text(formatDate(normalized.issue_date, normalized.timezone), 44, y + 20);
  pdf.text(formatDate(normalized.due_date, normalized.timezone), 170, y + 20);
  pdf.text(normalized.status.toUpperCase(), 296, y + 20);
  pdf.text(normalized.timezone, 408, y + 20);

  if (normalized.gst_enabled && brand.gstNumber) {
    pdf.text(`GSTIN: ${brand.gstNumber}`, 44, y + 42);
  }

  y += 66;
  pdf.setFillColor(247, 248, 252);
  pdf.roundedRect(leftX, y - 18, rightX - leftX, 30, 8, 8, "F");
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(leftX, y - 18, rightX - leftX, 30, 8, 8);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("Description", leftX, y);
  pdf.text("Qty", quantityX, y);
  pdf.text("Rate", rateX, y, { align: "right" });
  pdf.text("Amount", amountX, y, { align: "right" });
  y += 26;

  normalized.items.forEach((item, index) => {
    const quantity = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    const lineTotal = quantity * rate;
    const descriptionLines = pdf.splitTextToSize(
      `${index + 1}. ${item.description || "Untitled item"}`,
      280
    );
    const rowHeight = Math.max(descriptionLines.length * 15, 22);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(descriptionLines, leftX, y);
    pdf.text(String(quantity), quantityX, y);
    pdf.text(formatPdfMoney(rate, normalized.currency), rateX, y, {
      align: "right",
    });
    pdf.text(formatPdfMoney(lineTotal, normalized.currency), amountX, y, {
      align: "right",
    });
    y += rowHeight + 8;
    pdf.setDrawColor(232, 236, 243);
    pdf.line(leftX, y - 4, rightX, y - 4);
    y += 10;
  });

  const summaryHeight = normalized.tax_enabled ? 108 : 82;
  y += 14;
  pdf.setFillColor(249, 250, 251);
  pdf.roundedRect(summaryBoxX, y - 8, summaryBoxWidth, summaryHeight, 12, 12, "F");
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(summaryBoxX, y - 8, summaryBoxWidth, summaryHeight, 12, 12);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Subtotal", 354, y + 16);
  pdf.text(formatPdfMoney(normalized.subtotal, normalized.currency), amountX, y + 16, {
    align: "right",
  });

  let summaryOffset = 40;
  if (normalized.tax_enabled) {
    pdf.setFont("helvetica", "normal");
    pdf.text(taxLabel, 354, y + 40);
    pdf.text(
      formatPdfMoney(normalized.tax_amount, normalized.currency),
      amountX,
      y + 40,
      { align: "right" }
    );
    pdf.setDrawColor(226, 232, 240);
    pdf.line(summaryBoxX + 16, y + 52, amountX - 16, y + 52);
    summaryOffset = 74;
  } else {
    pdf.setDrawColor(226, 232, 240);
    pdf.line(summaryBoxX + 16, y + 36, amountX - 16, y + 36);
  }

  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Total", 354, y + summaryOffset);
  pdf.text(
    formatPdfMoney(normalized.total_amount, normalized.currency),
    amountX,
    y + summaryOffset,
    { align: "right" }
  );
  y += summaryHeight + 20;

  const notesHeight = normalized.notes ? 72 : 0;
  const paymentHeight =
    brand.paymentInstructions || brand.bankDetails ? 100 : 0;
  const footerHeight = brand.signatoryName || brand.footerNote ? 70 : 0;
  if (y + notesHeight + paymentHeight + footerHeight > pageBottom) {
    pdf.addPage();
    y = 56;
  }

  if (normalized.notes) {
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(44, y - 16, 507, 62, 12, 12, "F");
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(44, y - 16, 507, 62, 12, 12);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Notes", 60, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(normalized.notes, 60, y + 18, { maxWidth: 470 });
    y += 74;
  }

  if (brand.paymentInstructions || brand.bankDetails) {
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(44, y - 16, 507, 86, 12, 12, "F");
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(44, y - 16, 507, 86, 12, 12);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Payment Instructions", 60, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(
      brand.paymentInstructions || "Please complete payment by the due date.",
      60,
      y + 20,
      { maxWidth: 220 }
    );
    pdf.setFont("helvetica", "bold");
    pdf.text("Bank Details", 320, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(brand.bankDetails || "Add your bank details in the workspace.", 320, y + 20, {
      maxWidth: 200,
    });
    y += 98;
  }

  if (brand.signatoryName || brand.footerNote) {
    pdf.setDrawColor(203, 213, 225);
    pdf.line(60, y + 30, 220, y + 30);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(brand.signatoryName || "Authorized Signatory", 60, y + 46);
    pdf.text(brand.footerNote || "Thank you for your business.", 551, y + 46, {
      align: "right",
    });
  }

  pdf.save(`${normalized.invoice_number}.pdf`);
}

export default function Home() {
  const [authReady, setAuthReady] = useState(!supabase);
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(createInitialForm);
  const [brandProfile, setBrandProfile] = useState(createBrandProfile);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [emailComposer, setEmailComposer] = useState(null);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState("");
  const [loginError, setLoginError] = useState("");
  const [dataError, setDataError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(null);
  const [isSendingReminder, setIsSendingReminder] = useState(null);
  const configError = !supabase
    ? "Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel project settings."
    : "";

  const subtotal = useMemo(
    () =>
      form.items.reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.rate || 0),
        0
      ),
    [form.items]
  );
  const taxRateNumber = Number(form.taxRate || 0);
  const taxAmount = form.taxEnabled ? subtotal * (taxRateNumber / 100) : 0;
  const totalAmount = subtotal + taxAmount;
  const paidInvoices = invoices.filter((invoice) => invoice.status === "paid");
  const revenueData = useMemo(() => buildMonthlyRevenueData(invoices), [invoices]);
  const maxRevenue = Math.max(
    ...revenueData.map((item) => item.paid + item.pending),
    1
  );
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesFilter =
      historyFilter === "all" ? true : invoice.status === historyFilter;
    const matchesSearch = invoice.client_name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });
  const suggestedClients = clients.filter((client) =>
    client.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const getFriendlySupabaseError = (error, action) => {
    const message = error?.message || "";
    const normalized = message.toLowerCase();

    if (normalized.includes('relation "invoices" does not exist')) {
      return 'The "invoices" table does not exist in Supabase yet.';
    }

    if (normalized.includes("row-level security")) {
      return `Supabase blocked the ${action}. Check your Row Level Security policies for the invoices table.`;
    }

    if (normalized.includes("column") || normalized.includes("schema cache")) {
      return "Your database schema is missing the latest invoice fields. Run the new migration before using the new controls.";
    }

    return message || `Unable to ${action}. Please try again.`;
  };

  const fetchInvoices = useCallback(async (userId) => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      setDataError(getFriendlySupabaseError(error, "load invoices"));
      setInvoices([]);
      return;
    }

    setDataError("");
    setInvoices((data || []).map(normalizeInvoice));
  }, []);

  const fetchClients = useCallback(async (userId) => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true });

    if (error) return;
    setClients(data || []);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    const getUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session?.user) {
        setUser(data.session.user);
        fetchInvoices(data.session.user.id);
        fetchClients(data.session.user.id);
      }

      setAuthReady(true);
    };

    getUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          fetchInvoices(session.user.id);
          fetchClients(session.user.id);
        } else {
          setUser(null);
          setInvoices([]);
          setClients([]);
        }
        setAuthReady(true);
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchClients, fetchInvoices]);

  useEffect(() => {
    if (!user) return;

    const savedDraft = window.localStorage.getItem(getDraftStorageKey(user.id));
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        startTransition(() => {
          if (parsed.form) setForm(normalizeFormData(parsed.form));
          if (parsed.editingInvoiceId) setEditingInvoiceId(parsed.editingInvoiceId);
          if (parsed.lastDraftSavedAt) setLastDraftSavedAt(parsed.lastDraftSavedAt);
        });
      } catch {
        window.localStorage.removeItem(getDraftStorageKey(user.id));
      }
    }

    const savedBrand = window.localStorage.getItem(getBrandStorageKey(user.id));
    if (savedBrand) {
      try {
        const parsedBrand = JSON.parse(savedBrand);
        startTransition(() => {
          setBrandProfile(normalizeBrandProfileData(parsedBrand, user.email));
        });
      } catch {
        window.localStorage.removeItem(getBrandStorageKey(user.id));
        startTransition(() => {
          setBrandProfile(normalizeBrandProfileData({}, user.email));
        });
      }
    } else {
      startTransition(() => {
        setBrandProfile(normalizeBrandProfileData({}, user.email));
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const interval = window.setInterval(() => {
      const timestamp = new Date().toISOString();
      window.localStorage.setItem(
        getDraftStorageKey(user.id),
        JSON.stringify({
          form,
          editingInvoiceId,
          lastDraftSavedAt: timestamp,
        })
      );
      window.localStorage.setItem(
        getBrandStorageKey(user.id),
        JSON.stringify(brandProfile)
      );
      setLastDraftSavedAt(timestamp);
    }, 8000);

    return () => window.clearInterval(interval);
  }, [brandProfile, editingInvoiceId, form, user]);

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
      setLoginError(error.message || "Unable to start login. Please try again.");
      return;
    }

    if (data?.url) {
      window.location.assign(data.url);
      return;
    }

    setLoginError("Unable to start login. Please verify your Supabase auth settings.");
  };

  const logout = async () => {
    if (!supabase) return;

    await supabase.auth.signOut();
    setUser(null);
    setInvoices([]);
    setDataError("");
    setSaveSuccess("");
    setReminderMessage("");
    setEditingInvoiceId(null);
  };

  const updateFormField = (field, value) => {
    setForm((current) => {
      if (field === "gstEnabled") {
        return {
          ...current,
          gstEnabled: value,
          taxEnabled: value ? true : current.taxEnabled,
          taxLabel: value ? "GST" : current.taxLabel || "Tax",
        };
      }

      if (field === "taxEnabled" && !value) {
        return { ...current, taxEnabled: false };
      }

      return { ...current, [field]: value };
    });
  };

  const updateBrandField = (field, value) => {
    setBrandProfile((current) => ({ ...current, [field]: value }));
  };

  const updateItem = (index, field, value) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addItem = () => {
    setForm((current) => ({
      ...current,
      items: [...current.items, createEmptyItem()],
    }));
  };

  const removeItem = (index) => {
    setForm((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const resetDraft = () => {
    setForm(createInitialForm());
    setEditingInvoiceId(null);
    setClientSearch("");
    setDataError("");
    setReminderMessage("");

    if (user) {
      window.localStorage.removeItem(getDraftStorageKey(user.id));
    }
  };

  const clearSavedDraftState = () => {
    setForm(createInitialForm());
    setEditingInvoiceId(null);
    setClientSearch("");
    setLastDraftSavedAt("");

    if (user) {
      window.localStorage.removeItem(getDraftStorageKey(user.id));
    }
  };

  const startEditingInvoice = (invoice) => {
    setEditingInvoiceId(invoice.id);
    setForm(invoiceToForm(invoice));
    setClientSearch(invoice.client_name || "");
    setSaveSuccess(`Editing ${invoice.invoice_number}.`);
    setDataError("");
    setReminderMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      updateBrandField("logoDataUrl", dataUrl);
    } catch (error) {
      setDataError(error.message || "Unable to upload logo.");
    }
  };

  const applyClient = (client) => {
    setForm((current) => ({
      ...current,
      clientName: client.name || "",
      clientEmail: client.email || "",
      clientAddress: client.address || "",
      clientPhone: client.phone || "",
    }));
    setClientSearch(client.name || "");
  };

  const openEmailComposer = (invoice) => {
    setEmailComposer({
      invoiceId: invoice.id,
      subject: `${invoice.invoice_number} from ${brandProfile.companyName}`,
      message: `Hello ${invoice.client_name},\n\nSharing invoice ${invoice.invoice_number} for ${formatCurrency(
        invoice.total_amount,
        invoice.currency
      )}.\n\nPlease review the attached invoice and use the payment link if you'd like to pay online.\n\nThanks,\n${brandProfile.companyName}`,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validateForm = () => {
    const clientName = safeString(form.clientName).trim();
    const gstNumber = safeString(brandProfile.gstNumber).trim();

    if (!clientName) {
      return "Add a client name before saving.";
    }

    if (!form.items.some((item) => safeString(item.description).trim())) {
      return "Add at least one line item description.";
    }

    if (
      form.items.some(
        (item) => Number(item.quantity || 0) <= 0 || Number(item.rate || 0) < 0
      )
    ) {
      return "Each line item needs a quantity above 0 and a valid rate.";
    }

    if (form.gstEnabled && !gstNumber) {
      return "Add your GST number in the brand profile before saving a GST invoice.";
    }

    return "";
  };

  const saveInvoice = async () => {
    if (!supabase || !user) return;

    const validationError = validateForm();
    if (validationError) {
      setDataError(validationError);
      return;
    }

    const cleanedItems = form.items
      .filter((item) => safeString(item.description).trim())
      .map((item) => ({
        description: safeString(item.description).trim(),
        quantity: Number(item.quantity || 0),
        rate: Number(item.rate || 0),
      }));

    const invoiceNumber = safeString(form.invoiceNumber, createInvoiceNumber()).trim();
    const clientName = safeString(form.clientName).trim();
    const clientEmail = safeString(form.clientEmail).trim();
    const clientAddress = safeString(form.clientAddress).trim();
    const clientPhone = safeString(form.clientPhone).trim();
    const taxLabel = safeString(form.taxLabel, "Tax").trim() || "Tax";
    const paymentLink = safeString(form.paymentLink).trim();
    const notes = safeString(form.notes).trim();

    const payload = {
      user_id: user.id,
      invoice_number: invoiceNumber,
      client: clientName,
      client_name: clientName,
      client_email: clientEmail,
      client_address: clientAddress,
      client_phone: clientPhone,
      issue_date: form.issueDate,
      due_date: form.dueDate,
      next_issue_date: form.nextIssueDate,
      status: form.status,
      currency: form.currency,
      timezone: form.timezone,
      tax_enabled: form.taxEnabled,
      tax_label: form.gstEnabled ? "GST" : taxLabel,
      tax_rate: form.taxEnabled ? taxRateNumber : 0,
      gst_enabled: form.gstEnabled,
      reminder_enabled: form.reminderEnabled,
      recurring_enabled: form.recurringEnabled,
      recurring_frequency: form.recurringFrequency,
      subtotal,
      tax_amount: form.taxEnabled ? taxAmount : 0,
      total_amount: totalAmount,
      amount: totalAmount,
      payment_link: paymentLink,
      notes,
      items: cleanedItems,
    };

    setDataError("");
    setSaveSuccess("");
    setReminderMessage("");
    setIsSaving(true);

    const query = editingInvoiceId
      ? supabase
          .from("invoices")
          .update(payload)
          .eq("id", editingInvoiceId)
          .eq("user_id", user.id)
      : supabase.from("invoices").insert([payload]);

    const { error } = await query;
    setIsSaving(false);

    if (error) {
      setDataError(getFriendlySupabaseError(error, "save invoice"));
      return;
    }

    if (clientName) {
      await supabase.from("clients").upsert(
        [
          {
            user_id: user.id,
            name: clientName,
            email: clientEmail,
            address: clientAddress,
            phone: clientPhone,
          },
        ],
        { onConflict: "user_id,name" }
      );
      fetchClients(user.id);
    }

    setSaveSuccess(
      editingInvoiceId
        ? `Invoice ${payload.invoice_number} updated successfully.`
        : `Invoice ${payload.invoice_number} saved successfully.`
    );
    clearSavedDraftState();
    await fetchInvoices(user.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateInvoiceStatus = async (invoiceId, nextStatus) => {
    if (!supabase || !user) return;

    setIsUpdatingStatus(invoiceId);
    setDataError("");

    const { error } = await supabase
      .from("invoices")
      .update({ status: nextStatus })
      .eq("id", invoiceId)
      .eq("user_id", user.id);

    setIsUpdatingStatus(null);

    if (error) {
      setDataError(getFriendlySupabaseError(error, "update invoice status"));
      return;
    }

    setInvoices((current) =>
      current.map((invoice) =>
        invoice.id === invoiceId ? { ...invoice, status: nextStatus } : invoice
      )
    );
  };

  const sendReminderNow = async (invoiceId) => {
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice || !supabase) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    setIsSendingReminder(invoiceId);
    setReminderMessage("");
    setDataError("");

    const response = await fetch("/api/reminders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: session?.access_token ? `Bearer ${session.access_token}` : "",
      },
      body: JSON.stringify({
        invoiceId,
        brandProfile,
      }),
    });

    const result = await response.json();
    setIsSendingReminder(null);

    if (!response.ok) {
      setDataError(result.error || "Unable to send reminder.");
      return;
    }

    setReminderMessage(result.message || `Reminder sent for ${invoice.invoice_number}.`);
    fetchInvoices(user.id);
  };

  const sendInvoiceEmail = async () => {
    if (!emailComposer || !supabase) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    setIsSendingReminder(emailComposer.invoiceId);
    setDataError("");

    const response = await fetch("/api/send-invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: session?.access_token ? `Bearer ${session.access_token}` : "",
      },
      body: JSON.stringify({
        invoiceId: emailComposer.invoiceId,
        subject: emailComposer.subject,
        message: emailComposer.message,
        brandProfile,
      }),
    });

    const result = await response.json();
    setIsSendingReminder(null);

    if (!response.ok) {
      setDataError(result.error || "Unable to send invoice email.");
      return;
    }

    setSaveSuccess(result.message || "Invoice email sent.");
    setEmailComposer(null);
  };

  const shareViaWhatsApp = (invoice) => {
    const text = buildWhatsAppText(invoice, brandProfile);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const previewInvoicePayload = {
    invoice_number: form.invoiceNumber,
    client_name: form.clientName,
    client_email: form.clientEmail,
    client_address: form.clientAddress,
    client_phone: form.clientPhone,
    issue_date: form.issueDate,
    due_date: form.dueDate,
    next_issue_date: form.nextIssueDate,
    status: form.status,
    currency: form.currency,
    timezone: form.timezone,
    tax_enabled: form.taxEnabled,
    tax_label: form.gstEnabled ? "GST" : form.taxLabel,
    tax_rate: taxRateNumber,
    gst_enabled: form.gstEnabled,
    recurring_enabled: form.recurringEnabled,
    recurring_frequency: form.recurringFrequency,
    subtotal,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    payment_link: form.paymentLink,
    notes: form.notes,
    items: form.items,
  };

  if (configError) {
    return (
      <div className="min-h-screen px-6 py-16 text-center">
        <div className="mx-auto max-w-xl rounded-[32px] border border-white/60 bg-white/80 p-10 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            ForgeInvoice
          </h1>
          <p className="mt-4 text-base text-rose-700">{configError}</p>
        </div>
      </div>
    );
  }

  if (!authReady) {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto max-w-6xl rounded-[36px] border border-slate-200/80 bg-white/80 p-10 shadow-[0_40px_120px_rgba(15,23,42,0.10)]">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
            ForgeInvoice
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
            Restoring your workspace
          </h1>
          <p className="mt-4 text-slate-600">
            Checking your session and loading your invoices.
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="relative overflow-hidden rounded-[36px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.28),_transparent_28%),linear-gradient(135deg,_#fffdf7,_#eef4ff_58%,_#f8fafc)] p-8 shadow-[0_40px_120px_rgba(15,23,42,0.12)] sm:p-12">
            <div className="absolute inset-y-8 right-8 hidden w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent lg:block" />
            <div className="max-w-2xl">
              <p className="inline-flex rounded-full border border-slate-300/70 bg-white/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-slate-600">
                Studio-grade invoicing
              </p>
              <h1 className="mt-8 max-w-xl text-5xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-6xl">
                Build invoices that feel ready for real clients.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
                Google sign-in, saved sessions, reminders, mobile-ready actions,
                and premium PDF invoices for freelancers working across borders.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/70 bg-white/70 p-5 backdrop-blur">
                <p className="text-sm text-slate-500">Currencies</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">Global</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/70 p-5 backdrop-blur">
                <p className="text-sm text-slate-500">Export</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">Premium PDF</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/70 p-5 backdrop-blur">
                <p className="text-sm text-slate-500">Sharing</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">Email + WhatsApp</p>
              </div>
            </div>
          </section>

          <aside className="flex items-center">
            <div className="w-full rounded-[32px] border border-slate-200/80 bg-white/85 p-8 shadow-[0_25px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-10">
              <p className="text-sm uppercase tracking-[0.28em] text-slate-500">
                Welcome back
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
                Sign in with Google
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Your session stays persistent, and logout clears the workspace cleanly.
              </p>

              <button
                onClick={login}
                disabled={isLoggingIn}
                className="mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-slate-950 px-6 py-4 text-base font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingIn ? "Starting login..." : "Continue with Google"}
              </button>

              {loginError ? (
                <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {loginError}
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 pb-28 sm:px-6 sm:py-8 sm:pb-10">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(135deg,_rgba(255,255,255,0.88),_rgba(247,250,255,0.95)_46%,_rgba(255,248,235,0.96))] p-6 shadow-[0_30px_100px_rgba(15,23,42,0.10)] backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                ForgeInvoice Workspace
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Ship sharper invoices, faster.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                Create international-ready invoices with optional GST, reminders,
                WhatsApp sharing, and premium PDF exports. Signed in as {user.email}.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={resetDraft}
                className="min-h-12 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {editingInvoiceId ? "Cancel edit" : "Reset draft"}
              </button>
              <button
                onClick={logout}
                className="min-h-12 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/80 bg-white/75 p-5">
              <p className="text-sm text-slate-500">Invoices created</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{invoices.length}</p>
            </div>
            <div className="rounded-3xl border border-white/80 bg-white/75 p-5">
              <p className="text-sm text-slate-500">Collected</p>
              <p className="mt-3 text-lg font-semibold leading-8 text-slate-950">
                {summarizeTotalsByCurrency(paidInvoices)}
              </p>
            </div>
            <div className="rounded-3xl border border-white/80 bg-white/75 p-5">
              <p className="text-sm text-slate-500">Outstanding</p>
              <p className="mt-3 text-lg font-semibold leading-8 text-slate-950">
                {summarizeTotalsByCurrency(
                  invoices.filter((invoice) => invoice.status !== "paid")
                )}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
                    Create invoice
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {editingInvoiceId ? "Edit invoice" : "Invoice details"}
                  </h2>
                </div>
                <div className="text-sm text-slate-500 sm:text-right">
                  <p>Invoice number {form.invoiceNumber}</p>
                  <p className="mt-1">
                    Draft auto-saves every 8 seconds
                    {lastDraftSavedAt
                      ? ` • Last saved ${new Date(lastDraftSavedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : ""}
                  </p>
                </div>
              </div>

              {dataError ? (
                <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {dataError}
                </p>
              ) : null}

              {saveSuccess ? (
                <p className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {saveSuccess}
                </p>
              ) : null}

              {reminderMessage ? (
                <p className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                  {reminderMessage}
                </p>
              ) : null}

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Invoice number</span>
                  <input
                    value={form.invoiceNumber}
                    onChange={(event) => updateFormField("invoiceNumber", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Status</span>
                  <select
                    value={form.status}
                    onChange={(event) => updateFormField("status", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Client name</span>
                  <input
                    value={form.clientName}
                    onChange={(event) => {
                      updateFormField("clientName", event.target.value);
                      setClientSearch(event.target.value);
                    }}
                    placeholder="Aster Studio"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                  {clientSearch && suggestedClients.length > 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-2">
                      {suggestedClients.slice(0, 3).map((client) => (
                        <button
                          key={`${client.user_id}-${client.name}`}
                          onClick={() => applyClient(client)}
                          className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                        >
                          <span>{client.name}</span>
                          <span className="text-xs text-slate-400">{client.email || "Saved client"}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Client email</span>
                  <input
                    type="email"
                    value={form.clientEmail}
                    onChange={(event) => updateFormField("clientEmail", event.target.value)}
                    placeholder="finance@aster.studio"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Bill To address</span>
                  <textarea
                    rows={3}
                    value={form.clientAddress}
                    onChange={(event) => updateFormField("clientAddress", event.target.value)}
                    placeholder="22 Residency Road, Bengaluru, Karnataka"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Client phone</span>
                  <input
                    value={form.clientPhone}
                    onChange={(event) => updateFormField("clientPhone", event.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Issue date</span>
                  <input
                    type="date"
                    value={form.issueDate}
                    onChange={(event) => updateFormField("issueDate", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Due date</span>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => updateFormField("dueDate", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Currency</span>
                  <select
                    value={form.currency}
                    onChange={(event) => updateFormField("currency", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Timezone</span>
                  <select
                    value={form.timezone}
                    onChange={(event) => updateFormField("timezone", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    {TIMEZONE_OPTIONS.map((timezone) => (
                      <option key={timezone} value={timezone}>
                        {timezone}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 md:col-span-2">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex min-h-14 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">Enable tax</span>
                      <input
                        type="checkbox"
                        checked={form.taxEnabled}
                        onChange={(event) => updateFormField("taxEnabled", event.target.checked)}
                        className="h-5 w-5"
                      />
                    </label>

                    <label className="flex min-h-14 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">GST invoice</span>
                      <input
                        type="checkbox"
                        checked={form.gstEnabled}
                        onChange={(event) => updateFormField("gstEnabled", event.target.checked)}
                        className="h-5 w-5"
                      />
                    </label>

                    {form.taxEnabled ? (
                      <>
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">
                            {form.gstEnabled ? "GST rate %" : "Tax label"}
                          </span>
                          {form.gstEnabled ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={form.taxRate}
                              onChange={(event) => updateFormField("taxRate", event.target.value)}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                            />
                          ) : (
                            <input
                              value={form.taxLabel}
                              onChange={(event) => updateFormField("taxLabel", event.target.value)}
                              placeholder="Tax"
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                            />
                          )}
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">
                            {form.gstEnabled ? "GST rate %" : "Tax rate %"}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.taxRate}
                            onChange={(event) => updateFormField("taxRate", event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                          />
                        </label>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500 md:col-span-2">
                        Tax is off for this invoice. Totals will render without GST or any other tax line.
                      </div>
                    )}
                  </div>
                </div>

                <label className="flex min-h-14 items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Automatic email reminder</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Sends when due soon or overdue once reminders are configured on the backend.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.reminderEnabled}
                    onChange={(event) => updateFormField("reminderEnabled", event.target.checked)}
                    className="h-5 w-5"
                  />
                </label>

                <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 md:col-span-2">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex min-h-14 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">Recurring invoice</span>
                      <input
                        type="checkbox"
                        checked={form.recurringEnabled}
                        onChange={(event) => updateFormField("recurringEnabled", event.target.checked)}
                        className="h-5 w-5"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">Payment link</span>
                      <input
                        value={form.paymentLink}
                        onChange={(event) => updateFormField("paymentLink", event.target.value)}
                        placeholder="https://buy.stripe.com/... or https://rzp.io/..."
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                      />
                    </label>

                    {form.recurringEnabled ? (
                      <>
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">Frequency</span>
                          <select
                            value={form.recurringFrequency}
                            onChange={(event) =>
                              updateFormField("recurringFrequency", event.target.value)
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                          >
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                          </select>
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">Next issue date</span>
                          <input
                            type="date"
                            value={form.nextIssueDate}
                            onChange={(event) => updateFormField("nextIssueDate", event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                          />
                        </label>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
                      Line items
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-950">
                      Scope and pricing
                    </h3>
                  </div>
                  <button
                    onClick={addItem}
                    className="min-h-12 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Add item
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  {form.items.map((item, index) => (
                    <div
                      key={`${form.invoiceNumber}-${index}`}
                      className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-[1.6fr_0.5fr_0.6fr_auto]"
                    >
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">Description</span>
                        <input
                          value={item.description}
                          onChange={(event) => updateItem(index, "description", event.target.value)}
                          placeholder="Brand strategy sprint"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">Qty</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.quantity}
                          onChange={(event) => updateItem(index, "quantity", event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">Rate</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={(event) => updateItem(index, "rate", event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                        />
                      </label>

                      <div className="flex items-end">
                        <button
                          onClick={() => removeItem(index)}
                          disabled={form.items.length === 1}
                          className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <label className="mt-8 block space-y-2">
                <span className="text-sm font-medium text-slate-700">Notes</span>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) => updateFormField("notes", event.target.value)}
                  placeholder="Payment due within 14 days. Bank details available on request."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={saveInvoice}
                  disabled={isSaving}
                  className="min-h-14 rounded-2xl bg-slate-950 px-6 py-4 text-base font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving
                    ? editingInvoiceId
                      ? "Updating invoice..."
                      : "Saving invoice..."
                    : editingInvoiceId
                      ? "Update invoice"
                      : "Save invoice"}
                </button>
                <button
                  onClick={() => downloadInvoicePdf(previewInvoicePayload, brandProfile, user.email)}
                  className="min-h-14 rounded-2xl border border-slate-300 bg-white px-6 py-4 text-base font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Preview PDF
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Earnings dashboard</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    Revenue snapshot
                  </h2>
                </div>
                <p className="text-sm text-slate-500">Last 6 months</p>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-sm text-slate-500">Paid invoices</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {paidInvoices.length}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-sm text-slate-500">Pending invoices</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {invoices.filter((invoice) => invoice.status !== "paid").length}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex h-48 items-end gap-3">
                  {revenueData.map((month) => {
                    const combined = month.paid + month.pending;
                    const paidHeight = `${(month.paid / maxRevenue) * 100}%`;
                    const pendingHeight = `${(combined / maxRevenue) * 100}%`;

                    return (
                      <div key={month.key} className="flex flex-1 flex-col items-center gap-3">
                        <div className="relative flex h-36 w-full items-end justify-center rounded-2xl bg-white">
                          <div
                            className="absolute bottom-0 w-8 rounded-t-2xl bg-sky-100"
                            style={{ height: pendingHeight }}
                          />
                          <div
                            className="absolute bottom-0 w-8 rounded-t-2xl bg-slate-950"
                            style={{ height: paidHeight }}
                          />
                        </div>
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                          {month.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-slate-950" />
                    Paid
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-sky-100" />
                    Pending
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.16)] sm:p-8">
              <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Live summary</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                {form.clientName || "New client draft"}
              </h2>
              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="text-slate-400">Subtotal</span>
                  <span className="text-lg font-medium">{formatCurrency(subtotal, form.currency)}</span>
                </div>
                {form.taxEnabled ? (
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <span className="text-slate-400">{form.gstEnabled ? "GST" : form.taxLabel}</span>
                    <span className="text-lg font-medium">{formatCurrency(taxAmount, form.currency)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total</span>
                  <span className="text-2xl font-semibold">{formatCurrency(totalAmount, form.currency)}</span>
                </div>
              </div>

              <div className="mt-8 rounded-3xl bg-white/6 p-5">
                <p className="text-sm text-slate-400">Timeline</p>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Issued</p>
                    <p className="mt-1 font-medium text-white">
                      {formatDate(form.issueDate, form.timezone)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Due</p>
                    <p className="mt-1 font-medium text-white">
                      {formatDate(form.dueDate, form.timezone)}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-400">Timezone: {form.timezone}</p>
              </div>

              <div className="mt-6 rounded-3xl bg-white/6 p-5">
                <p className="text-sm text-slate-400">Client snapshot</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Email</span>
                    <span className="text-right text-white">
                      {form.clientEmail || "Not added"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Phone</span>
                    <span className="text-right text-white">
                      {form.clientPhone || "Not added"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-slate-500">Billing</span>
                    <span className="max-w-[14rem] text-right text-white">
                      {form.clientAddress || "No billing address yet"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-3xl bg-white/6 p-5">
                <p className="text-sm text-slate-400">Delivery controls</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Recurring</span>
                    <span className="text-right text-white">
                      {form.recurringEnabled
                        ? `${form.recurringFrequency} • ${formatDate(form.nextIssueDate, form.timezone)}`
                        : "Off"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Reminder</span>
                    <span className="text-right text-white">
                      {form.reminderEnabled ? "Enabled" : "Off"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-slate-500">Payment link</span>
                    <span className="max-w-[14rem] text-right text-white">
                      {form.paymentLink ? "Attached" : "Not added"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {emailComposer ? (
              <div className="rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-8">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Send invoice</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                      Email composer
                    </h2>
                  </div>
                  <button
                    onClick={() => setEmailComposer(null)}
                    className="min-h-11 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-6 grid gap-4">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Subject</span>
                    <input
                      value={emailComposer.subject}
                      onChange={(event) =>
                        setEmailComposer((current) => ({ ...current, subject: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Message</span>
                    <textarea
                      rows={6}
                      value={emailComposer.message}
                      onChange={(event) =>
                        setEmailComposer((current) => ({ ...current, message: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>

                  <button
                    onClick={sendInvoiceEmail}
                    disabled={isSendingReminder === emailComposer.invoiceId}
                    className="min-h-12 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSendingReminder === emailComposer.invoiceId ? "Sending email..." : "Send invoice email"}
                  </button>
                </div>
              </div>
            ) : null}

          </div>
        </section>

        <section className="mt-6">
          <div className="rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Brand profile</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  PDF branding
                </h2>
              </div>
              <p className="text-sm text-slate-500">Auto-saved</p>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Company name</span>
                <input
                  value={brandProfile.companyName}
                  onChange={(event) => updateBrandField("companyName", event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Company email</span>
                <input
                  type="email"
                  value={brandProfile.companyEmail}
                  onChange={(event) => updateBrandField("companyEmail", event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>

              <label className="space-y-2 lg:col-span-2">
                <span className="text-sm font-medium text-slate-700">Sender address</span>
                <textarea
                  rows={3}
                  value={brandProfile.companyAddress}
                  onChange={(event) => updateBrandField("companyAddress", event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">GST number</span>
                <input
                  value={brandProfile.gstNumber}
                  onChange={(event) => updateBrandField("gstNumber", event.target.value)}
                  placeholder="29ABCDE1234F1Z5"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>

              <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Logo</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Upload a square PNG or JPG for your PDF header.
                    </p>
                  </div>
                  <label className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100">
                    Upload logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {brandProfile.logoDataUrl ? (
                  <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-white p-3">
                    <Image
                      src={brandProfile.logoDataUrl}
                      alt="Brand logo preview"
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-2xl object-cover"
                    />
                    <button
                      onClick={() => updateBrandField("logoDataUrl", "")}
                      className="min-h-12 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      Remove logo
                    </button>
                  </div>
                ) : null}
              </div>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Payment instructions</span>
                <textarea
                  rows={3}
                  value={brandProfile.paymentInstructions}
                  onChange={(event) => updateBrandField("paymentInstructions", event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Bank details</span>
                <textarea
                  rows={3}
                  value={brandProfile.bankDetails}
                  onChange={(event) => updateBrandField("bankDetails", event.target.value)}
                  placeholder="Bank name, account number, IFSC / SWIFT, beneficiary"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>

              <div className="grid gap-4 lg:col-span-2 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Signatory name</span>
                  <input
                    value={brandProfile.signatoryName}
                    onChange={(event) => updateBrandField("signatoryName", event.target.value)}
                    placeholder="Chintan Tejani"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Footer note</span>
                  <input
                    value={brandProfile.footerNote}
                    onChange={(event) => updateBrandField("footerNote", event.target.value)}
                    placeholder="Thank you for your business."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Invoice history</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Recent invoices
                </h2>
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by client name"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white lg:min-w-72"
                />
                <div className="flex flex-wrap gap-2">
                  {INVOICE_FILTERS.map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setHistoryFilter(filter)}
                      className={`min-h-11 rounded-2xl px-4 py-2 text-sm font-medium transition ${
                        historyFilter === filter
                          ? "bg-slate-950 text-white"
                          : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      {filter === "all"
                        ? "All"
                        : filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {filteredInvoices.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-slate-500 xl:col-span-2">
                  No invoices match this view yet. Save or search for another invoice.
                </div>
              ) : null}

              {filteredInvoices.map((invoice) => (
                <article
                  key={invoice.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-slate-950">
                          {invoice.invoice_number}
                        </h3>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                            STATUS_STYLES[invoice.status] || STATUS_STYLES.draft
                          }`}
                        >
                          {invoice.status}
                        </span>
                      </div>
                      <p className="mt-2 text-base text-slate-700">{invoice.client_name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Issued {formatDate(invoice.issue_date, invoice.timezone)} • Due{" "}
                        {formatDate(invoice.due_date, invoice.timezone)}
                      </p>
                      {invoice.last_reminder_sent_at ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Reminder sent {formatDateTime(invoice.last_reminder_sent_at, invoice.timezone)}
                        </p>
                      ) : null}
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-sm text-slate-500">Invoice total</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">
                        {formatCurrency(invoice.total_amount, invoice.currency)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    {invoice.payment_link ? (
                      <a
                        href={invoice.payment_link}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-11 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                      >
                        Pay now
                      </a>
                    ) : null}
                    <button
                      onClick={() => startEditingInvoice(invoice)}
                      className="min-h-11 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openEmailComposer(invoice)}
                      className="min-h-11 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                    >
                      Email invoice
                    </button>
                    <button
                      onClick={() =>
                        updateInvoiceStatus(
                          invoice.id,
                          invoice.status === "paid" ? "pending" : "paid"
                        )
                      }
                      disabled={isUpdatingStatus === invoice.id}
                      className="min-h-11 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUpdatingStatus === invoice.id
                        ? "Updating..."
                        : invoice.status === "paid"
                          ? "Mark pending"
                          : "Mark paid"}
                    </button>
                    <button
                      onClick={() => sendReminderNow(invoice.id)}
                      disabled={isSendingReminder === invoice.id}
                      className="min-h-11 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSendingReminder === invoice.id ? "Sending..." : "Send reminder"}
                    </button>
                    <button
                      onClick={() => shareViaWhatsApp(invoice)}
                      className="min-h-11 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                    >
                      Share WhatsApp
                    </button>
                    <button
                      onClick={() => downloadInvoicePdf(invoice, brandProfile, user.email)}
                      className="min-h-11 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                    >
                      Download PDF
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/80 bg-white/95 px-4 py-3 shadow-[0_-12px_40px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-7xl gap-3">
          <button
            onClick={saveInvoice}
            disabled={isSaving}
            className="min-h-14 flex-1 rounded-2xl bg-slate-950 px-5 py-4 text-base font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : editingInvoiceId ? "Update" : "Save"}
          </button>
          <button
            onClick={() => downloadInvoicePdf(previewInvoicePayload, brandProfile, user.email)}
            className="min-h-14 flex-1 rounded-2xl border border-slate-300 bg-white px-5 py-4 text-base font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Preview PDF
          </button>
        </div>
      </div>

      <div className="sticky bottom-4 z-10 mt-6 hidden sm:block">
        <div className="mx-auto flex max-w-fit gap-3 rounded-[24px] border border-slate-200/80 bg-white/90 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur">
          <button
            onClick={saveInvoice}
            disabled={isSaving}
            className="min-h-12 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving
              ? editingInvoiceId
                ? "Updating invoice..."
                : "Saving invoice..."
              : editingInvoiceId
                ? "Update invoice"
                : "Save invoice"}
          </button>
          <button
            onClick={() => downloadInvoicePdf(previewInvoicePayload, brandProfile, user.email)}
            className="min-h-12 rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Preview PDF
          </button>
          <button
            onClick={() => shareViaWhatsApp(previewInvoicePayload)}
            className="min-h-12 rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            WhatsApp draft
          </button>
        </div>
      </div>
    </main>
  );
}
