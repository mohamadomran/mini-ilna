import { describe, it, expect } from "vitest";
import { prisma } from "../lib/db";
import { resetDb } from "./_utils/db";
import { POST as inbound } from "../app/api/channels/wa/inbound/route";

function tomorrowAt(h: number, m = 0) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d;
}

describe("POST /api/channels/wa/inbound (Booking flow)", () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('creates a booking and returns ISO time for "tomorrow after 3pm"', async () => {
    const t = await prisma.tenants.create({
      data: {
        name: "Serenity Spa",
        email: `serenity-${Date.now()}@x.local`,
        website: `https://serenity-${Date.now()}.example`,
      },
    });

    const req = new Request("https://localhost/api/channels/wa/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: t.id,
        from: "+971500000001",
        text: "I'd like a 60m massage tomorrow after 3pm",
      }),
    });

    const res = await inbound(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.type).toBe("booking");
    expect(body.bookingId).toBeTruthy();
    expect(typeof body.start).toBe("string");

    // Ensure the returned ISO is tomorrow between 15:00 and 18:00
    const start = new Date(body.start);
    const lower = tomorrowAt(15, 0).getTime();
    const upper = tomorrowAt(18, 0).getTime();
    expect(start.getTime()).toBeGreaterThanOrEqual(lower);
    expect(start.getTime()).toBeLessThanOrEqual(upper);

    // Ensure the booking persisited for the same tenant
    const persisted = await prisma.bookings.findUnique({
      where: { id: body.bookingId },
      select: {
        id: true,
        tenant_id: true,
        service: true,
        customer_phone: true,
      },
    });

    expect(persisted?.tenant_id).toBe(t.id);
    expect(persisted?.customer_phone).toBe("+971500000001");
    expect((persisted?.service || "").toLowerCase()).toContain("massage");
  });

  it('respects explicit times like "book tomorrow at 2pm"', async () => {
    const t = await prisma.tenants.create({
      data: {
        name: "Explicit Time Spa",
        email: `explicit-${Date.now()}@x.local`,
        website: `https://explicit-${Date.now()}.example`,
      },
    });

    const req = new Request("https://localhost/api/channels/wa/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: t.id,
        from: "+971500000777",
        text: "Please book tomorrow at 2pm",
      }),
    });

    const res = await inbound(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.type).toBe("booking");
    expect(body.bookingId).toBeTruthy();

    const start = new Date(body.start);
    const targetLower = tomorrowAt(14, 0).getTime();
    const targetUpper = tomorrowAt(15, 0).getTime();

    expect(start.getTime()).toBeGreaterThanOrEqual(targetLower);
    expect(start.getTime()).toBeLessThan(targetUpper);
  });

  it("400s on invalid body", async () => {
    const bad = new Request("https://localhost/api/channels/wa/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nope: true }),
    });

    const res = await inbound(bad);
    expect([400, 422]).toContain(res.status);
  });
});
