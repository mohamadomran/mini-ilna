import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: { id: string } };

export async function POST(_req: Request, { params }: Params) {
  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: "Missing invoice id" }, { status: 400 });
  }

  // check if invoice exists
  const existing = await prisma.invoices.findUnique({
    where: { id },
    select: { id: true, status: true, paylink: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const updated = await prisma.invoices.update({
    where: { id },
    data: { status: "sent" },
    select: { id: true, status: true, paylink: true },
  });

  return NextResponse.json(
    {
      type: "sent",
      paylink: updated.paylink,
      status: updated.status,
    },
    { status: 200 }
  );
}
