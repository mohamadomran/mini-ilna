import Link from "next/link";
import { getTranslations } from "next-intl/server";

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
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }> | { locale: string };
  searchParams: Promise<SearchParams> | SearchParams;
}) {
  const { locale } = await params;
  const { tenantId } = await searchParams;
  const t = await getTranslations({ locale, namespace: "bookings" });

  const kbCount = await prisma.kb_chunks.count({
    where: { tenant_id: tenantId ?? undefined },
  });

  const summary = t("header.summary", {
    tenantLabel: t("header.tenantLabel"),
    tenant: tenantId ?? t("header.noTenant"),
    kb: t("header.kbCount", { count: kbCount }),
  });

  const bookingsPath = `/${locale}/bookings`;
  const onboardPath = `/${locale}/onboard`;

  if (!tenantId) {
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

    const counts = Object.fromEntries(
      await Promise.all(
        tenants.map(async (tenant) => {
          const count = await prisma.bookings.count({
            where: { tenant_id: tenant.id },
          });
          return [tenant.id, count] as const;
        })
      )
    );

    return (
      <div className="max-w-5xl w-5xl space-y-8 mx-auto">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t("title")}</h1>
            <p className="text-sm text-slate-500">{summary}</p>
          </div>
        </header>

        <div className="card">
          <h2 className="font-medium mb-3">{t("directory.tenants.title")}</h2>
          {tenants.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t.rich("directory.tenants.empty", {
                link: (chunks) => (
                  <Link href={onboardPath} className="underline">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {tenants.map((tenant) => (
                <li
                  key={tenant.id}
                  className="py-3 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{tenant.name}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {tenant.website}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {t("directory.tenants.count", {
                        count: counts[tenant.id] ?? 0,
                      })}
                    </span>
                    <Link
                      className="btn btn-primary"
                      href={`${bookingsPath}?tenantId=${tenant.id}`}
                    >
                      {t("directory.tenants.open")}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="font-medium mb-3">{t("directory.recent.title")}</h2>
          {recentBookings.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("directory.recent.empty")}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentBookings.map((booking) => (
                <li
                  key={booking.id}
                  className="py-3 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {booking.tenant?.name ?? t("directory.recent.unknownTenant")}
                    </div>
                    <div className="text-xs text-slate-500">
                      {booking.service} • {fmt(booking.start_time)} • {booking.customer_phone}
                    </div>
                  </div>
                  <Link
                    className="btn"
                    href={`${bookingsPath}?tenantId=${booking.tenant?.id ?? ""}#booking-${booking.id}`}
                  >
                    {t("directory.recent.view")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500 mt-3">
            {t("directory.recent.hint")}
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

  const returnTo = `${bookingsPath}?tenantId=${tenantId}`;

  return (
    <div className="space-y-8 max-w-5xl w-5xl mx-auto">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-slate-500">{summary}</p>
        </div>
        <form action={reingestTenantKb}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <button type="submit" className="btn btn-secondary">
            {t("actions.reingest")}
          </button>
        </form>
      </header>
      <Chat tenantId={tenantId} />

      <div className="card overflow-x-auto">
        <h2 className="font-medium mb-3">{t("tables.bookings.title")}</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2 pr-4">{t("tables.bookings.headers.start")}</th>
              <th className="py-2 pr-4">{t("tables.bookings.headers.service")}</th>
              <th className="py-2 pr-4">{t("tables.bookings.headers.customer")}</th>
              <th className="py-2 pr-4">{t("tables.bookings.headers.created")}</th>
              <th className="py-2 pr-4">{t("tables.bookings.headers.action")}</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-slate-500">
                  {t("tables.bookings.empty")}
                </td>
              </tr>
            )}
            {bookings.map((booking) => (
              <tr
                key={booking.id}
                id={`booking-${booking.id}`}
                className="border-t border-slate-100 dark:border-slate-800"
              >
                <td className="py-3 pr-4 font-mono">{fmt(booking.start_time)}</td>
                <td className="py-3 pr-4">{booking.service}</td>
                <td className="py-3 pr-4">{booking.customer_phone}</td>
                <td className="py-3 pr-4 font-mono">{fmt(booking.created_at)}</td>
                <td className="py-3 pr-4">
                  <form
                    action={createAndSendPaylink}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="tenantId" value={tenantId} />
                    <input
                      type="hidden"
                      name="phone"
                      value={booking.customer_phone}
                    />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <input
                      name="amount"
                      type="number"
                      min={1}
                      defaultValue={100}
                      className="input w-28"
                      aria-label={t("tables.bookings.amountLabel")}
                    />
                    <button className="btn btn-primary" type="submit">
                      {t("tables.bookings.sendPaylink")}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-500 mt-2">
          {t.rich("tables.bookings.hint", {
            bold: (chunks) => <b>{chunks}</b>,
          })}
        </p>
      </div>

      <div className="card overflow-x-auto" id="invoices">
        <h2 className="font-medium mb-3">{t("tables.invoices.title")}</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2 pr-4">{t("tables.invoices.headers.created")}</th>
              <th className="py-2 pr-4">{t("tables.invoices.headers.customer")}</th>
              <th className="py-2 pr-4">{t("tables.invoices.headers.amount")}</th>
              <th className="py-2 pr-4">{t("tables.invoices.headers.status")}</th>
              <th className="py-2 pr-4">{t("tables.invoices.headers.paylink")}</th>
              <th className="py-2 pr-4">{t("tables.invoices.headers.action")}</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-slate-500">
                  {t("tables.invoices.empty")}
                </td>
              </tr>
            )}
            {invoices.map((invoice) => (
              <tr
                key={invoice.id}
                id={`invoice-${invoice.id}`}
                className="border-t border-slate-100 dark:border-slate-800"
              >
                <td className="py-3 pr-4 font-mono">{fmt(invoice.created_at)}</td>
                <td className="py-3 pr-4">{invoice.customer_phone}</td>
                <td className="py-3 pr-4">{invoice.amount} AED</td>
                <td className="py-3 pr-4">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      invoice.status === "paid"
                        ? "bg-green-100 text-green-700"
                        : invoice.status === "sent"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {t(`status.${invoice.status}` as const)}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  {invoice.paylink ? (
                    <a
                      href={invoice.paylink}
                      className="underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("tables.invoices.openLink")}
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  {invoice.status === "paid" ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <div className="flex gap-2">
                      {invoice.status !== "sent" && (
                        <form action={sendExistingInvoice}>
                          <input
                            type="hidden"
                            name="invoiceId"
                            value={invoice.id}
                          />
                          <input
                            type="hidden"
                            name="returnTo"
                            value={returnTo}
                          />
                          <button className="btn btn-secondary" type="submit">
                            {t("tables.invoices.send")}
                          </button>
                        </form>
                      )}
                      <form action={markInvoicePaid}>
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <button className="btn" type="submit">
                          {t("tables.invoices.markPaid")}
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
          {t.rich("tables.invoices.hint", {
            bold: (chunks) => <b>{chunks}</b>,
          })}
        </p>
      </div>
    </div>
  );
}
