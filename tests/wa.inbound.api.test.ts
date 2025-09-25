import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../lib/db";
import { resetDb } from "./_utils/db";
import { tokenize } from "../lib/rank";
import { POST as inbound } from "@/app/api/channels/wa/inbound/route";

function tfForm(text: string) {
  const tf: Record<string, number> = Object.create(null);
  for (const tok of tokenize(text)) tf[tok] = (tf[tok] ?? 0) + 1;
  return tf;
}

describe("POST /api/channels/wa/inbound (FAQ flow)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns an FAQ reply with citation when asked about opening hours.", async () => {
    const tenant = await prisma.tenants.create({
      data: {
        name: "Serenity Spa",
        email: `serenity-${Date.now()}@x.local`,
        website: `https://serenity-${Date.now()}.example`,
      },
    });

    const filler1 =
      "We offer a validaty of wellness services including message and facials.";
    const target =
      "Opening hours: 10:00–20:00 daily. Walk-ins welcome; bookings recommended on weekends.";
    const filler2 =
      "Our therapists are certified and focus on client comfort and care.";

    await prisma.kb_chunks.createMany({
      data: [
        {
          tenant_id: tenant.id,
          text: filler1,
          meta: { tf: tfForm(filler1) },
        },
        {
          tenant_id: tenant.id,
          text: target,
          meta: { tf: tfForm(target) },
        },
        {
          tenant_id: tenant.id,
          text: filler2,
          meta: { tf: tfForm(filler2) },
        },
      ],
    });

    const req = new Request("http://localhost/api/channels/wa/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: tenant.id,
        from: "+97150000000",
        text: "what are your opening hours",
      }),
    });

    const res = await inbound(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.type).toBe("faq");
    expect(typeof body.reply).toBe("string");
    expect(body.reply.length).toBeGreaterThanOrEqual(0);
    expect(body.reply.length).toBeLessThanOrEqual(200);

    expect(body.chunkId).toBeTruthy();
    expect(body.reply).toMatch(/10:00|20:00|Opening hours/i);

    const cited = await prisma.kb_chunks.findUnique({
      where: { id: body.chunkId },
      select: { id: true, tenant_id: true },
    });
    expect(cited?.tenant_id).toBe(tenant.id);
  });

  it("400s on invalid body", async () => {
    const badRequest = new Request("http://localhost/api/channels/wa/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ whoops: true }),
    });

    const res = await inbound(badRequest);
    expect([400, 422]).toContain(res.status);
  });
});
