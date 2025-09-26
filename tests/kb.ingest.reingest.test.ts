import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./_utils/db";
import { prisma } from "../lib/db";
import { POST as ingestHandler } from "../app/api/kb/ingest/route";

function buildRequest(tenantId: string) {
  return new Request(`http://localhost/api/kb/ingest?tenantId=${tenantId}`, {
    method: "POST",
  });
}

describe("KB ingest", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("ingests fixture HTML and replaces existing chunks", async () => {
    const tenant = await prisma.tenants.create({
      data: {
        name: "Serenity",
        email: "serenity@test.local",
        website: "https://serenity.example",
      },
    });

    const res1 = await ingestHandler(buildRequest(tenant.id));
    expect(res1.status).toBe(200);
    const firstBody = await res1.json();
    expect(firstBody.chunks).toBeGreaterThan(0);

    // mutate a chunk to ensure it gets replaced
    await prisma.kb_chunks.updateMany({
      where: { tenant_id: tenant.id },
      data: { text: "outdated" },
    });

    const res2 = await ingestHandler(buildRequest(tenant.id));
    expect(res2.status).toBe(200);

    const chunks = await prisma.kb_chunks.findMany({
      where: { tenant_id: tenant.id },
      orderBy: { created_at: "desc" },
      select: { text: true },
    });

    expect(chunks.length).toBe(firstBody.chunks);
    expect(chunks.some((c) => c.text.includes("Open Monday"))).toBe(true);
    expect(chunks.some((c) => c.text === "outdated")).toBe(false);
  });

  it("404s for unknown tenant", async () => {
    const res = await ingestHandler(buildRequest("does-not-exist"));
    expect(res.status).toBe(404);
  });
});
