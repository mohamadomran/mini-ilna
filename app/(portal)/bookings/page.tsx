// app/(portal)/bookings/page.tsx
import { prisma } from "@/lib/db";
import {
  createAndSendPaylink,
  sendExistingInvoice,
  simulateInbound,
  markInvoicePaid,
} from "./actions";

type SearchParams = { tenantId?: string };

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { tenantId } = await searchParams;

  if (!tenantId) {
    return (
      <div className="max-w-3xl space-y-4 mx-auto">
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <div className="card">
          <p className="text-sm text-slate-500">
            Provide <code className="font-mono">?tenantId=…</code> in the URL to
            view data.
          </p>
        </div>
      </div>
    );
  }

  const [bookings, invoices] = await Promise.all([
    prisma.bookings.findMany({
      where: { tenant_id: tenantId },
      orderBy: { start_time: "asc" },
      select: {
        id: true,
        service: true,
        start_time: true,
        customer_phone: true,
        created_at: true,
      },
    }),
    prisma.invoices.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        status: true,
        paylink: true,
        customer_phone: true,
        amount: true,
        created_at: true,
      },
    }),
  ]);

  const returnTo = `/bookings?tenantId=${tenantId}`;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bookings</h1>
          <p className="text-sm text-slate-500">
            Tenant: <code className="font-mono">{tenantId}</code>
          </p>
        </div>
      </header>

      {/* WhatsApp-like simulator */}
      <div className="card">
        <h2 className="font-medium mb-3">WhatsApp simulator</h2>
        <form
          action={simulateInbound}
          className="flex flex-wrap gap-2 items-center"
        >
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input
            name="from"
            placeholder="+9715…"
            className="input w-48"
            required
          />
          <input
            name="text"
            placeholder='Try: "What are your opening hours?" or "60m massage tomorrow after 3pm" or "Can I pay a deposit now?"'
            className="input flex-1 min-w-[18rem]"
            required
          />
          <button className="btn btn-primary" type="submit">
            Send
          </button>
        </form>
        <p className="text-xs text-slate-500 mt-2">
          Posts to <code className="font-mono">/api/channels/wa/inbound</code>,
          which may create a booking or invoice depending on your text.
        </p>
      </div>

      {/* Bookings table */}
      <div className="card overflow-x-auto">
        <h2 className="font-medium mb-3">Bookings</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2 pr-4">Start</th>
              <th className="py-2 pr-4">Service</th>
              <th className="py-2 pr-4">Customer</th>
              <th className="py-2 pr-4">Created</th>
              <th className="py-2 pr-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-slate-500">
                  No bookings yet. Use the simulator above to create one.
                </td>
              </tr>
            )}
            {bookings.map((b) => (
              <tr
                key={b.id}
                className="border-t border-slate-100 dark:border-slate-800"
              >
                <td className="py-3 pr-4 font-mono">
                  {b.start_time.toISOString().replace("T", " ").slice(0, 16)}
                </td>
                <td className="py-3 pr-4">{b.service}</td>
                <td className="py-3 pr-4">{b.customer_phone}</td>
                <td className="py-3 pr-4 font-mono">
                  {b.created_at.toISOString().replace("T", " ").slice(0, 16)}
                </td>
                <td className="py-3 pr-4">
                  <form
                    action={createAndSendPaylink}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="tenantId" value={tenantId} />
                    <input
                      type="hidden"
                      name="phone"
                      value={b.customer_phone}
                    />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <input
                      name="amount"
                      type="number"
                      min={1}
                      defaultValue={100}
                      className="input w-28"
                      aria-label="Amount"
                    />
                    <button className="btn btn-primary" type="submit">
                      Send paylink
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-500 mt-2">
          “Send paylink” creates a pending invoice and flips it to <b>sent</b>.
        </p>
      </div>

      {/* Invoices table */}
      <div className="card overflow-x-auto" id="invoices">
        <h2 className="font-medium mb-3">Invoices</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2 pr-4">Created</th>
              <th className="py-2 pr-4">Customer</th>
              <th className="py-2 pr-4">Amount</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Paylink</th>
              <th className="py-2 pr-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-slate-500">
                  No invoices yet.
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr
                key={inv.id}
                id={`invoice-${inv.id}`}
                className="border-t border-slate-100 dark:border-slate-800"
              >
                <td className="py-3 pr-4 font-mono">
                  {inv.created_at.toISOString().replace("T", " ").slice(0, 16)}
                </td>
                <td className="py-3 pr-4">{inv.customer_phone}</td>
                <td className="py-3 pr-4">{inv.amount} AED</td>
                <td className="py-3 pr-4">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      inv.status === "paid"
                        ? "bg-green-100 text-green-700"
                        : inv.status === "sent"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {inv.status}
                  </span>
                </td>

                <td className="py-3 pr-4">
                  {inv.status === "paid" ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <div className="flex gap-2">
                      {inv.status !== "sent" && (
                        <form action={sendExistingInvoice}>
                          <input
                            type="hidden"
                            name="invoiceId"
                            value={inv.id}
                          />
                          <input
                            type="hidden"
                            name="returnTo"
                            value={returnTo}
                          />
                          <button className="btn btn-secondary" type="submit">
                            Send
                          </button>
                        </form>
                      )}
                      <form action={markInvoicePaid}>
                        <input type="hidden" name="invoiceId" value={inv.id} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <button className="btn" type="submit">
                          Mark paid
                        </button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-500 mt-2">
          The “open” link returns to this page anchored on the invoice row.
          “Mark paid” sets status to <b>paid</b>.
        </p>
      </div>
    </div>
  );
}
