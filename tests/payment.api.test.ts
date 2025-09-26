import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "../lib/db";
import { POST as inbound } from "../app/api/channels/wa/inbound/route";
import { POST as sendInvoice } from "../app/api/invoices/[id]/send/route";
import { POST as markPaid } from "../app/api/invoices/[id]/mark-paid/route";
import { resetDb } from "./_utils/db";

describe("Payment flow", () => {
  beforeAll(async () => {
    await resetDb();
  });

  it("inbound payment intent creates a pending invoice and returns a paylink", async () => {
    const t = await prisma.tenants.create({
      data: {
        name: "Serenity Spa",
        email: `serenity-${Date.now()}@x.local`,
        website: `https://serenity-${Date.now()}.example`,
      },
    });

    const req = new Request("http://localhost/api/channels/wa/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: t.id,
        from: "+971500000002",
        text: "Can I pay a deposit now with my card",
      }),
    });

    const res = await inbound(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.type).toBe("payment");
    expect(body.invoiceId).toBeTruthy();
    expect(typeof body.paylink).toBe("string");
    expect(body.paylink.length).toBeGreaterThan(10);

    //check DB row
    const inv = await prisma.invoices.findUnique({
      where: { id: body.invoiceId },
      select: {
        id: true,
        tenant_id: true,
        status: true,
        paylink: true,
        customer_phone: true,
      },
    });

    expect(inv?.tenant_id).toBe(t.id);
    expect(inv?.status).toBe("pending");
    expect(inv?.customer_phone).toBe("+971500000002");
    expect((inv?.paylink || "").includes(inv!.id)).toBe(true);
  });

  it("POST /api/invoices/:id/send flips status to sent and returns the paylink", async () => {
    const t = await prisma.tenants.create({
      data: {
        name: "Glow Spa",
        email: `glow-${Date.now()}@x.local`,
        website: `https://glow-${Date.now()}.example`,
      },
    });

    const inv = await prisma.invoices.create({
      data: {
        tenant_id: t.id,
        amount: 150,
        currency: "AED",
        status: "pending",
        paylink: `http://localhost:3000/pay/manual-${Date.now()}`,
        customer_phone: "+971500000009",
      },
      select: { id: true },
    });

    const req = new Request(`http://localhost/api/invoices/${inv.id}/send`, {
      method: "POST",
    });

    const res = await sendInvoice(req, { params: { id: inv.id } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.type).toBe("sent");
    expect(typeof body.paylink).toBe("string");

    const updated = await prisma.invoices.findUnique({
      where: { id: inv.id },
      select: { status: true },
    });
    expect(updated?.status).toBe("sent");
  });

  it("POST /api/invoices/:id/send 404s for unknown id", async () => {
    const res = await sendInvoice(
      new Request("http://localhost/api/invoices/does-not-exist/send", {
        method: "POST",
      }),
      { params: { id: "does-not-exist" } }
    );

    expect(res.status).toBe(404);
  });

  it("POST /api/invoices/:id/mark-paid flips status to paid", async () => {
    const tenant = await prisma.tenants.create({
      data: {
        name: "Pay Later",
        email: `pay-${Date.now()}@test.local`,
        website: `https://pay-${Date.now()}.example`,
      },
    });

    const invoice = await prisma.invoices.create({
      data: {
        tenant_id: tenant.id,
        amount: 220,
        currency: "AED",
        status: "sent",
        paylink: `http://localhost:3000/pay/${Date.now()}`,
        customer_phone: "+971500000777",
      },
      select: { id: true },
    });

    const res = await markPaid(new Request("http://localhost/api/invoices", {
      method: "POST",
    }), {
      params: { id: invoice.id },
    });

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.status).toBe("paid");
    expect(json.tenantId).toBe(tenant.id);

    const updated = await prisma.invoices.findUnique({
      where: { id: invoice.id },
      select: { status: true },
    });

    expect(updated?.status).toBe("paid");
  });
});
