"use client";

import Image from "next/image";
import { startTransition, useCallback, useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import { supabase } from "../lib/supabase";

const STATUS_STYLES = {
  draft: "bg-amber-100 text-amber-800",
  pending: "bg-sky-100 text-sky-800",
  paid: "bg-emerald-100 text-emerald-800",
  overdue: "bg-rose-100 text-rose-800",
};

const INVOICE_FILTERS = ["all", "draft", "pending", "paid"];

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
    issueDate: getTodayDateString(),
    dueDate: getFutureDateString(14),
    status: "draft",
    currency: "INR",
    taxRate: "18",
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
    paymentInstructions: "Please make payment within the due date mentioned on this invoice.",
    bankDetails: "",
    signatoryName: "",
    footerNote: "Thank you for your business.",
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
  const currencySymbols = {
    INR: "INR",
    USD: "USD",
    EUR: "EUR",
    GBP: "GBP",
  };

  return `${currencySymbols[currency] || currency} ${formatCurrencyAmount(value)}`;
}

function formatDate(value) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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

function normalizeInvoice(inv) {
  const items =
    Array.isArray(inv.items) && inv.items.length > 0
      ? inv.items
      : [
          {
            description: inv.project_description || inv.client || "Invoice item",
            quantity: "1",
            rate: inv.total_amount ?? inv.amount ?? 0,
          },
        ];

  const subtotal = Number(inv.subtotal ?? inv.amount ?? inv.total_amount ?? 0);
  const taxAmount = Number(inv.tax_amount ?? 0);
  const totalAmount = Number(inv.total_amount ?? inv.amount ?? 0);

  return {
    ...inv,
    invoice_number: inv.invoice_number || `INV-${inv.id}`,
    client_name: inv.client_name || inv.client || "Untitled client",
    client_email: inv.client_email || "",
    client_address: inv.client_address || "",
    issue_date: inv.issue_date || inv.created_at?.split("T")[0] || "",
    due_date: inv.due_date || "",
    status: inv.status === "sent" ? "pending" : inv.status || "draft",
    currency: inv.currency || "INR",
    tax_rate: Number(inv.tax_rate ?? 0),
    subtotal,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    notes: inv.notes || "",
    items,
  };
}

function invoiceToForm(invoice) {
  const normalized = normalizeInvoice(invoice);

  return {
    invoiceNumber: normalized.invoice_number,
    clientName: normalized.client_name,
    clientEmail: normalized.client_email,
    clientAddress: normalized.client_address,
    issueDate: normalized.issue_date || getTodayDateString(),
    dueDate: normalized.due_date || getFutureDateString(14),
    status: normalized.status,
    currency: normalized.currency,
    taxRate: String(normalized.tax_rate ?? 0),
    notes: normalized.notes || "",
    items:
      normalized.items?.map((item) => ({
        description: item.description || "",
        quantity: String(item.quantity ?? 1),
        rate: String(item.rate ?? 0),
      })) || [createEmptyItem()],
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read logo file."));
    reader.readAsDataURL(file);
  });
}

async function downloadInvoicePdf(invoice, brandProfile, accountEmail) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const normalized = normalizeInvoice(invoice);
  const brand = brandProfile || createBrandProfile(accountEmail);
  let y = 56;
  const pageWidth = 595;
  const leftX = 44;
  const rightX = 551;
  const quantityX = 360;
  const rateX = 450;
  const amountX = 551;
  const summaryBoxX = 334;
  const summaryBoxWidth = 217;
  const pageBottom = 770;

  pdf.setFillColor(22, 33, 62);
  pdf.rect(0, 0, pageWidth, 120, "F");

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
  pdf.roundedRect(leftX, y - 18, 240, 96, 12, 12, "F");
  pdf.roundedRect(312, y - 18, 239, 96, 12, 12, "F");
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(leftX, y - 18, 240, 96, 12, 12);
  pdf.roundedRect(312, y - 18, 239, 96, 12, 12);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("From", 60, y);
  pdf.text("Bill To", 328, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text(brand.companyName || "ForgeInvoice", 60, y + 22);
  if (brand.companyAddress) {
    pdf.text(brand.companyAddress, 60, y + 40, { maxWidth: 200 });
  }
  pdf.text(brand.companyEmail || accountEmail || "your-team@example.com", 60, y + 72);
  pdf.text(normalized.client_name, 328, y + 22);
  if (normalized.client_address) {
    pdf.text(normalized.client_address, 328, y + 40, { maxWidth: 190 });
  }
  if (normalized.client_email) {
    pdf.text(normalized.client_email, 328, y + 72);
  }

  y += 116;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("Issue Date", 44, y);
  pdf.text("Due Date", 170, y);
  pdf.text("Status", 296, y);
  pdf.text("Currency", 408, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text(formatDate(normalized.issue_date), 44, y + 20);
  pdf.text(formatDate(normalized.due_date), 170, y + 20);
  pdf.text(normalized.status.toUpperCase(), 296, y + 20);
  pdf.text(normalized.currency, 408, y + 20);

  y += 54;
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

  y += 14;
  pdf.setFillColor(249, 250, 251);
  pdf.roundedRect(summaryBoxX, y - 8, summaryBoxWidth, 86, 12, 12, "F");
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(summaryBoxX, y - 8, summaryBoxWidth, 86, 12, 12);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Subtotal", 354, y + 16);
  pdf.text(formatPdfMoney(normalized.subtotal, normalized.currency), amountX, y + 16, {
    align: "right",
  });
  pdf.setFont("helvetica", "normal");
  pdf.text("Tax", 354, y + 40);
  pdf.text(formatPdfMoney(normalized.tax_amount, normalized.currency), amountX, y + 40, {
    align: "right",
  });
  pdf.setDrawColor(226, 232, 240);
  pdf.line(summaryBoxX + 16, y + 51, amountX - 16, y + 51);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Total", 354, y + 74);
  pdf.text(formatPdfMoney(normalized.total_amount, normalized.currency), amountX, y + 74, {
    align: "right",
  });
  y += 106;

  const notesHeight = normalized.notes ? 72 : 0;
  const paymentHeight =
    brand.paymentInstructions || brand.bankDetails ? 96 : 0;
  const footerHeight = brand.signatoryName || brand.footerNote ? 70 : 0;
  const reservedHeight = notesHeight + paymentHeight + footerHeight + 40;
  if (y + reservedHeight > pageBottom) {
    pdf.addPage();
    y = 56;
  }

  if (normalized.notes) {
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(44, y - 16, 507, 62, 12, 12, "F");
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(44, y - 16, 507, 62, 12, 12);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("Notes", 60, y);
    y += 18;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(normalized.notes, 60, y, { maxWidth: 470 });
    y += 54;
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
    y += 96;
  }

  if (brand.signatoryName || brand.footerNote) {
    pdf.setDrawColor(203, 213, 225);
    pdf.line(60, y + 30, 220, y + 30);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(brand.signatoryName || "Authorized Signatory", 60, y + 46);
    pdf.text(
      brand.footerNote || "Thank you for your business.",
      551,
      y + 46,
      { align: "right" }
    );
  }

  pdf.save(`${normalized.invoice_number}.pdf`);
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(createInitialForm);
  const [brandProfile, setBrandProfile] = useState(createBrandProfile);
  const [invoices, setInvoices] = useState([]);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [dataError, setDataError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(null);
  const configError = !supabase
    ? "Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel project settings."
    : "";

  const subtotal = form.items.reduce((sum, item) => {
    return sum + Number(item.quantity || 0) * Number(item.rate || 0);
  }, 0);
  const taxAmount = subtotal * (Number(form.taxRate || 0) / 100);
  const totalAmount = subtotal + taxAmount;
  const paidInvoices = invoices.filter((invoice) => invoice.status === "paid");
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesFilter =
      historyFilter === "all" ? true : invoice.status === historyFilter;
    const matchesSearch = invoice.client_name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

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
      return "Your database is still using the older invoices schema. Run the new migration before saving advanced invoices.";
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
  }, [fetchInvoices]);

  useEffect(() => {
    if (!user) return;

    const savedDraft = window.localStorage.getItem(getDraftStorageKey(user.id));
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        startTransition(() => {
          if (parsed.form) setForm(parsed.form);
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
          setBrandProfile(parsedBrand);
        });
      } catch {
        window.localStorage.removeItem(getBrandStorageKey(user.id));
        startTransition(() => {
          setBrandProfile(createBrandProfile(user.email));
        });
      }
    } else {
      startTransition(() => {
        setBrandProfile(createBrandProfile(user.email));
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

  useEffect(() => {
    if (!supabase) return;

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          fetchInvoices(session.user.id);
        } else {
          setUser(null);
          setInvoices([]);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [fetchInvoices]);

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
    setEditingInvoiceId(null);
  };

  const updateFormField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
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
    setDataError("");
    setSaveSuccess("");

    if (user) {
      window.localStorage.removeItem(getDraftStorageKey(user.id));
    }
  };

  const startEditingInvoice = (invoice) => {
    setEditingInvoiceId(invoice.id);
    setForm(invoiceToForm(invoice));
    setSaveSuccess(`Editing ${invoice.invoice_number}.`);
    setDataError("");
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

  const validateForm = () => {
    if (!form.clientName.trim()) {
      return "Add a client name before saving.";
    }

    if (!form.items.some((item) => item.description.trim())) {
      return "Add at least one line item description.";
    }

    if (
      form.items.some(
        (item) => Number(item.quantity || 0) <= 0 || Number(item.rate || 0) < 0
      )
    ) {
      return "Each line item needs a quantity above 0 and a valid rate.";
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
      .filter((item) => item.description.trim())
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity || 0),
        rate: Number(item.rate || 0),
      }));

    setDataError("");
    setSaveSuccess("");
    setIsSaving(true);

    const payload = {
      user_id: user.id,
      invoice_number: form.invoiceNumber.trim(),
      client: form.clientName.trim(),
      client_name: form.clientName.trim(),
      client_email: form.clientEmail.trim(),
      client_address: form.clientAddress.trim(),
      issue_date: form.issueDate,
      due_date: form.dueDate,
      status: form.status,
      currency: form.currency,
      tax_rate: Number(form.taxRate || 0),
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      amount: totalAmount,
      notes: form.notes.trim(),
      items: cleanedItems,
    };

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

    setSaveSuccess(
      editingInvoiceId
        ? `Invoice ${payload.invoice_number} updated successfully.`
        : `Invoice ${payload.invoice_number} saved successfully.`
    );
    if (user) {
      window.localStorage.removeItem(getDraftStorageKey(user.id));
    }
    setForm(createInitialForm());
    setEditingInvoiceId(null);
    setLastDraftSavedAt("");
    fetchInvoices(user.id);
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
                ForgeInvoice helps you log in fast, capture rich invoice details,
                track payment status, and export polished PDFs without leaving the
                browser.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/70 bg-white/70 p-5 backdrop-blur">
                <p className="text-sm text-slate-500">Line items</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">Multi</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/70 p-5 backdrop-blur">
                <p className="text-sm text-slate-500">Export</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">PDF</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/70 p-5 backdrop-blur">
                <p className="text-sm text-slate-500">Status</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">Live</p>
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
                Use your Google account to create, track, and export invoices
                from one workspace.
              </p>

              <button
                onClick={login}
                disabled={isLoggingIn}
                className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-6 py-4 text-base font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
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
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
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
                Create detailed invoices with line items, due dates, taxes, notes,
                and downloadable PDFs. Signed in as {user.email}.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={resetDraft}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {editingInvoiceId ? "Cancel edit" : "Reset draft"}
              </button>
              <button
                onClick={logout}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/80 bg-white/75 p-5">
              <p className="text-sm text-slate-500">Invoices created</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">
                {invoices.length}
              </p>
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

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Invoice number
                  </span>
                  <input
                    value={form.invoiceNumber}
                    onChange={(event) =>
                      updateFormField("invoiceNumber", event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Status</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateFormField("status", event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Client name
                  </span>
                  <input
                    value={form.clientName}
                    onChange={(event) =>
                      updateFormField("clientName", event.target.value)
                    }
                    placeholder="Aster Studio"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Client email
                  </span>
                  <input
                    type="email"
                    value={form.clientEmail}
                    onChange={(event) =>
                      updateFormField("clientEmail", event.target.value)
                    }
                    placeholder="finance@aster.studio"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    Client address
                  </span>
                  <textarea
                    rows={3}
                    value={form.clientAddress}
                    onChange={(event) =>
                      updateFormField("clientAddress", event.target.value)
                    }
                    placeholder="22 Residency Road, Bengaluru, Karnataka"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Issue date
                  </span>
                  <input
                    type="date"
                    value={form.issueDate}
                    onChange={(event) =>
                      updateFormField("issueDate", event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Due date
                  </span>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(event) =>
                      updateFormField("dueDate", event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Currency</span>
                  <select
                    value={form.currency}
                    onChange={(event) =>
                      updateFormField("currency", event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Tax rate %
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.taxRate}
                    onChange={(event) =>
                      updateFormField("taxRate", event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>
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
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
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
                        <span className="text-sm font-medium text-slate-700">
                          Description
                        </span>
                        <input
                          value={item.description}
                          onChange={(event) =>
                            updateItem(index, "description", event.target.value)
                          }
                          placeholder="Brand strategy sprint"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">
                          Qty
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(index, "quantity", event.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">
                          Rate
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={(event) =>
                            updateItem(index, "rate", event.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                        />
                      </label>

                      <div className="flex items-end">
                        <button
                          onClick={() => removeItem(index)}
                          disabled={form.items.length === 1}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
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
                  onChange={(event) =>
                    updateFormField("notes", event.target.value)
                  }
                  placeholder="Payment due within 14 days. Bank details available on request."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={saveInvoice}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-6 py-4 text-base font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
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
                  onClick={() =>
                    downloadInvoicePdf(
                      {
                        invoice_number: form.invoiceNumber,
                        client_name: form.clientName,
                        issue_date: form.issueDate,
                        due_date: form.dueDate,
                        status: form.status,
                        currency: form.currency,
                        subtotal,
                        tax_amount: taxAmount,
                        total_amount: totalAmount,
                        notes: form.notes,
                        items: form.items,
                      },
                      brandProfile,
                      user.email
                    )
                  }
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-4 text-base font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Preview PDF
                </button>
              </div>

              {dataError ? (
                <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {dataError}
                </p>
              ) : null}

              {saveSuccess ? (
                <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {saveSuccess}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.16)] sm:p-8">
              <p className="text-sm uppercase tracking-[0.22em] text-slate-400">
                Live summary
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                {form.clientName || "New client draft"}
              </h2>
              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="text-slate-400">Subtotal</span>
                  <span className="text-lg font-medium">
                    {formatCurrency(subtotal, form.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="text-slate-400">Tax</span>
                  <span className="text-lg font-medium">
                    {formatCurrency(taxAmount, form.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total</span>
                  <span className="text-2xl font-semibold">
                    {formatCurrency(totalAmount, form.currency)}
                  </span>
                </div>
              </div>

              <div className="mt-8 rounded-3xl bg-white/6 p-5">
                <p className="text-sm text-slate-400">Timeline</p>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Issued</p>
                    <p className="mt-1 font-medium text-white">
                      {formatDate(form.issueDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Due</p>
                    <p className="mt-1 font-medium text-white">
                      {formatDate(form.dueDate)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
                    Brand profile
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    PDF branding
                  </h2>
                </div>
                <p className="text-sm text-slate-500">Auto-saved</p>
              </div>

              <div className="mt-6 grid gap-4">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Company name
                  </span>
                  <input
                    value={brandProfile.companyName}
                    onChange={(event) =>
                      updateBrandField("companyName", event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Company email
                  </span>
                  <input
                    type="email"
                    value={brandProfile.companyEmail}
                    onChange={(event) =>
                      updateBrandField("companyEmail", event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Company address
                  </span>
                  <textarea
                    rows={3}
                    value={brandProfile.companyAddress}
                    onChange={(event) =>
                      updateBrandField("companyAddress", event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Payment instructions
                  </span>
                  <textarea
                    rows={3}
                    value={brandProfile.paymentInstructions}
                    onChange={(event) =>
                      updateBrandField("paymentInstructions", event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Bank details
                  </span>
                  <textarea
                    rows={3}
                    value={brandProfile.bankDetails}
                    onChange={(event) =>
                      updateBrandField("bankDetails", event.target.value)
                    }
                    placeholder="Bank name, account number, IFSC / SWIFT, beneficiary"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Signatory name
                    </span>
                    <input
                      value={brandProfile.signatoryName}
                      onChange={(event) =>
                        updateBrandField("signatoryName", event.target.value)
                      }
                      placeholder="Chintan Tejani"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Footer note
                    </span>
                    <input
                      value={brandProfile.footerNote}
                      onChange={(event) =>
                        updateBrandField("footerNote", event.target.value)
                      }
                      placeholder="Thank you for your business."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Logo</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Upload a square PNG or JPG for your PDF header.
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100">
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
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        Remove logo
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
                    Invoice history
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    Recent invoices
                  </h2>
                </div>
                <p className="text-sm text-slate-500">{filteredInvoices.length} shown</p>
              </div>

              <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by client name"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white lg:max-w-xs"
                />
                <div className="flex flex-wrap gap-2">
                  {INVOICE_FILTERS.map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setHistoryFilter(filter)}
                      className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
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

              <div className="mt-6 space-y-4">
                {filteredInvoices.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-slate-500">
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
                        <p className="mt-2 text-base text-slate-700">
                          {invoice.client_name}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Issued {formatDate(invoice.issue_date)}{" "}
                          {invoice.due_date ? `• Due ${formatDate(invoice.due_date)}` : ""}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-sm text-slate-500">Invoice total</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">
                          {formatCurrency(invoice.total_amount, invoice.currency)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        onClick={() => startEditingInvoice(invoice)}
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          updateInvoiceStatus(
                            invoice.id,
                            invoice.status === "paid" ? "pending" : "paid"
                          )
                        }
                        disabled={isUpdatingStatus === invoice.id}
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isUpdatingStatus === invoice.id
                          ? "Updating..."
                          : invoice.status === "paid"
                            ? "Mark pending"
                            : "Mark paid"}
                      </button>
                      <button
                        onClick={() =>
                          downloadInvoicePdf(invoice, brandProfile, user.email)
                        }
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                      >
                        Download PDF
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
