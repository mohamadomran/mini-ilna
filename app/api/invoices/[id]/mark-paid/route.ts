import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

async function markPaid(id: string) {
  const exists = await prisma.invoices.findUnique({
    where: { id },
    select: { id: true, tenant_id: true },
  });

  if (!exists) return { ok: false as const, status: 404 as const };

  const updated = await prisma.invoices.update({
    where: { id },
    data: { status: "paid" },
    select: { id: true, status: true, tenant_id: true },
  });

  return { ok: true as const, status: 200 as const, invoice: updated };
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const r = await markPaid(params.id);
  if (!r.ok)
    return NextResponse.json({ error: "Not found" }, { status: r.status });
  return NextResponse.json({
    ok: true,
    status: r.invoice.status,
    tenantId: r.invoice.tenant_id,
  });
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const r = await markPaid(params.id);

  if (!r.ok)
    return NextResponse.json({ error: "Not found" }, { status: r.status });

  const next = new URL(req.url).searchParams.get("next");
  if (next) return NextResponse.redirect(new URL(next, req.url));

  return NextResponse.json({
    ok: true,
    status: r.invoice.status,
    tenantId: r.invoice.tenant_id,
  });
}
