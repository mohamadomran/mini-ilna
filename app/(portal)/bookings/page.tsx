import { prisma } from "@/lib/db";
import {
  createAndSendPaylink,
  sendExistingInvoice,
  reingestTenantKb,
  markInvoicePaid,
} from "./actions";
import Chat from "./Chat";

type SearchParams = { tenantId?: string };

function fmt(dt: Date) {
  return dt.toISOString().replace("T", " ").slice(0, 16);
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { tenantId } = await searchParams;

  const [kbCount] = await Promise.all([
    prisma.kb_chunks.count({ where: { tenant_id: tenantId } }),
  ]);

  if (!tenantId) {
    // Load a compact directory view when no tenantId is provided
    const [tenants, recentBookings] = await Promise.all([
      prisma.tenants.findMany({
        orderBy: { created_at: "desc" },
        select: { id: true, name: true, website: true, created_at: true },
      }),
      prisma.bookings.findMany({
        orderBy: { created_at: "desc" },
        take: 8,
        select: {
          id: true,
          service: true,
          start_time: true,
          customer_phone: true,
          created_at: true,
          tenant: { select: { id: true, name: true } },
        },
      }),
    ]);

    // Precompute counts (cheap on SQLite w/ small data; if you’d like, replace with a single GROUP BY query)
    const counts = Object.fromEntries(
      await Promise.all(
        tenants.map(async (t) => {
          const c = await prisma.bookings.count({ where: { tenant_id: t.id } });
          return [t.id, c] as const;
        })
      )
    );

    return (
      <div className="max-w-5xl w-5xl space-y-8 mx-auto">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Bookings</h1>
            <p className="text-sm text-slate-500">
              Tenant: <code className="font-mono">{tenantId}</code>{" "}
              <span className="ml-2">• KB chunks: {kbCount}</span>
            </p>
          </div>
          <form action={reingestTenantKb}>
            <input type="hidden" name="tenantId" value={tenantId} />
            <button type="submit" className="btn btn-secondary">
              Re-ingest
            </button>
          </form>
        </header>

        {/* Tenants directory */}
        <div className="card">
          <h2 className="font-medium mb-3">Tenants</h2>
          {tenants.length === 0 ? (
            <p className="text-sm text-slate-500">
              No tenants yet. Go to{" "}
              <a href="/onboard" className="underline">
                Onboard
              </a>{" "}
              to add one.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {tenants.map((t) => (
                <li
                  key={t.id}
                  className="py-3 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.name}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {t.website}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {counts[t.id] ?? 0} booking
                      {(counts[t.id] ?? 0) === 1 ? "" : "s"}
                    </span>
                    <a
                      className="btn btn-primary"
                      href={`/bookings?tenantId=${t.id}`}
                    >
                      Open
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="font-medium mb-3">Recent bookings</h2>
          {recentBookings.length === 0 ? (
            <p className="text-sm text-slate-500">No bookings yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentBookings.map((b) => (
                <li
                  key={b.id}
                  className="py-3 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {b.tenant?.name ?? "Unknown tenant"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {b.service} • {fmt(b.start_time)} • {b.customer_phone}
                    </div>
                  </div>
                  <a
                    className="btn"
                    href={`/bookings?tenantId=${b.tenant?.id ?? ""}#booking-${
                      b.id
                    }`}
                  >
                    View
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500 mt-3">
            Selecting a booking jumps to its row in the tenant view.
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
    <div className="space-y-8 max-w-5xl w-5xl mx-auto">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bookings</h1>
          <p className="text-sm text-slate-500">
            Tenant: <code className="font-mono">{tenantId}</code>
          </p>
        </div>
      </header>
      <Chat tenantId={tenantId} />

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
                  No bookings yet. Use the chat above to create one.
                </td>
              </tr>
            )}
            {bookings.map((b) => (
              <tr
                key={b.id}
                id={`booking-${b.id}`}
                className="border-t border-slate-100 dark:border-slate-800"
              >
                <td className="py-3 pr-4 font-mono">{fmt(b.start_time)}</td>
                <td className="py-3 pr-4">{b.service}</td>
                <td className="py-3 pr-4">{b.customer_phone}</td>
                <td className="py-3 pr-4 font-mono">{fmt(b.created_at)}</td>
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
                <td className="py-3 pr-4 font-mono">{fmt(inv.created_at)}</td>
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
                  {inv.paylink ? (
                    <a
                      href={inv.paylink}
                      className="underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      open
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
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
