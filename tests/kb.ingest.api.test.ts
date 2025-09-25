import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../lib/db";
import { POST as ingest } from "../app/api/kb/ingest/route";
import { promises as fs } from "node:fs";
import path from "node:path";
import { resetDb } from "./_utils/db";

describe("POST /api/kb/ingest", () => {
  beforeEach(async () => {
    await resetDb(); // CALL IT
    const fixturesDir = path.join(process.cwd(), "fixtures");
    await fs.mkdir(fixturesDir, { recursive: true });
    const filePath = path.join(fixturesDir, "website.html"); // correct name

    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(
        filePath,
        `<html><body><h1>Serenity Spa</h1><p>Opening hours: 10:00–20:00 daily.</p><p>We offer massage and facial services.</p></body></html>`
      );
    }
  });

  it("ingests and inserts > 0 chunks (>=10 for real fixture)", async () => {
    const t = await prisma.tenants.create({
      data: {
        name: "Demo",
        email: `demo-${Date.now()}@x.local`,
        website: `https://demo-${Date.now()}.example`,
      },
    });

    const res = await ingest(
      new Request(`http://localhost/api/kb/ingest?tenantId=${t.id}`, {
        method: "POST",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.chunks).toBeGreaterThan(0);

    const count = await prisma.kb_chunks.count({ where: { tenant_id: t.id } });
    expect(count).toBeGreaterThan(0);
  });
});
