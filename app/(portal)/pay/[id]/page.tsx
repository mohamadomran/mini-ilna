import { prisma } from "@/lib/db";
import Link from "next/link";
import { revalidatePath } from "next/cache";

type Props = { params: Promise<{ id: string }> };

/** Server action: mark this invoice paid and refresh this page */
export async function simulatePay(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Idempotent-ish: allow pending/sent to flip to paid
  await prisma.invoices.update({
    where: { id },
    data: { status: "paid" },
  });

  // Re-render this pay page with the new status
  revalidatePath(`/pay/${id}`);
}

export default async function PayPage({ params }: Props) {
  const { id } = await params;

  const invoice = await prisma.invoices.findUnique({
    where: { id },
    select: {
      id: true,
      tenant_id: true,
      amount: true,
      currency: true,
      status: true,
      customer_phone: true,
      created_at: true,
    },
  });

  if (!invoice) {
    return (
      <main className="max-w-lg mx-auto p-6">
        <div className="card">
          <h1 className="text-xl font-semibold mb-2">Invoice not found</h1>
          <p className="text-slate-500">
            The payment link is invalid or expired.
          </p>
        </div>
      </main>
    );
  }

  const sent = invoice.status === "sent";
  const paid = invoice.status === "paid";

  return (
    <main className="max-w-lg mx-auto p-6 space-y-6">
      <div className="card space-y-3">
        <h1 className="text-xl font-semibold">Pay Invoice</h1>

        <div className="text-sm text-slate-600 space-y-1">
          <div>
            <b>ID:</b> <code className="font-mono">{invoice.id}</code>
          </div>
          <div>
            <b>Amount:</b> {invoice.amount} {invoice.currency}
          </div>
          <div>
            <b>Customer:</b> {invoice.customer_phone}
          </div>
          <div>
            <b>Status:</b>{" "}
            <span
              className={`px-2 py-1 rounded text-xs ${
                paid
                  ? "bg-green-100 text-green-700"
                  : sent
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {invoice.status}
            </span>
          </div>
        </div>

        {!paid ? (
          <form action={simulatePay}>
            <input type="hidden" name="id" value={invoice.id} />
            <button className="btn btn-primary w-full" type="submit">
              Pay now (simulate)
            </button>
          </form>
        ) : (
          <div className="rounded-md bg-green-50 text-green-800 text-sm px-3 py-2">
            Payment successful. Thank you!
          </div>
        )}
      </div>

      <div className="text-center">
        <Link
          href={`/bookings?tenantId=${invoice.tenant_id}`}
          className="underline"
        >
          Back to bookings
        </Link>
      </div>
    </main>
  );
}
