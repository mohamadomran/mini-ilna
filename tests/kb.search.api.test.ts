import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../lib/db";
import { GET as searchHandler } from "../app/api/kb/search/route";
import { resetDb } from "./_utils/db";

describe("GET /api/kb/search", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns relevant chunks for query 'opening hours'", async () => {
    const tenant = await prisma.tenants.create({
      data: {
        name: "Serenity Spa",
        email: `spa-${Date.now()}@test.local`,
        website: `https://spa-${Date.now()}.example`,
      },
    });

    await prisma.kb_chunks.createMany({
      data: [
        {
          tenant_id: tenant.id,
          text: "Our opening hours are 10:00–20:00 daily.",
          meta: { tf: { opening: 1, hours: 1 } },
        },
        {
          tenant_id: tenant.id,
          text: "We offer massage and facial services.",
          meta: { tf: { message: 1, facial: 1 } },
        },
      ],
    });

    const request = new Request(
      `http://localhost/api/kb/search?q=opening%20hours&tenantId=${tenant.id}`
    );

    const response = await searchHandler(request);

    expect(response.status).toBe(200);

    const results = await response.json();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    expect(results[0].text.toLowerCase()).toContain("opening hours");
  });
});
