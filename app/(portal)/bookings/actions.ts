"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createAndSendPaylink(formData: FormData) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const amount = Number(formData.get("amount") ?? 100);
  const returnTo = String(formData.get("returnTo") ?? "/bookings");
  if (!tenantId || !phone) return;

  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const created = await prisma.invoices.create({
    data: {
      tenant_id: tenantId,
      amount,
      currency: "AED",
      status: "pending",
      paylink: "",
      customer_phone: phone,
    },
    select: { id: true },
  });

  const paylink = `${base}/bookings?tenantId=${tenantId}#invoice-${created.id}`;
  await prisma.invoices.update({
    where: { id: created.id },
    data: { paylink },
  });

  await fetch(`${base}/api/invoices/${created.id}/send`, {
    method: "POST",
    cache: "no-store",
  });

  revalidatePath("/bookings");
  redirect(returnTo);
}

/** Flip an existing invoice to "sent". */
export async function sendExistingInvoice(formData: FormData) {
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/bookings");
  if (!invoiceId) return;

  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  await fetch(`${base}/api/invoices/${invoiceId}/send`, {
    method: "POST",
    cache: "no-store",
  });

  revalidatePath("/bookings");
  redirect(returnTo);
}

/** Mark invoice as PAID directly from the table. */
export async function markInvoicePaid(formData: FormData) {
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/bookings");
  if (!invoiceId) return;

  await prisma.invoices.update({
    where: { id: invoiceId },
    data: { status: "paid" },
  });

  revalidatePath("/bookings");
  redirect(returnTo);
}

/** Simple WhatsApp simulator (FAQ/booking/payment). */
export async function simulateInbound(formData: FormData) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const from = String(formData.get("from") ?? "");
  const text = String(formData.get("text") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/bookings");
  if (!tenantId || !from || !text) return;

  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  await fetch(`${base}/api/channels/wa/inbound`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenantId, from, text }),
    cache: "no-store",
  });

  revalidatePath("/bookings");
  redirect(returnTo);
}
