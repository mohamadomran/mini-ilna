import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../lib/db";
import { POST as createTenant } from "../app/api/tenants/route";
import { resetDb } from "./_utils/db";

describe("POST /api/tenants", () => {
  beforeEach(resetDb);

  it("201 + returns id on valid body", async () => {
    const uniq = Date.now();
    const req = new Request("http://localhost/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Serenity Spa",
        email: `owner-${uniq}@serenity.local`,
        website: `https://serenity-${uniq}.example`,
      }),
    });

    const res = await createTenant(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();

    const row = await prisma.tenants.findUnique({ where: { id: body.id } });
    expect(row?.email).toBe(`owner-${uniq}@serenity.local`);
  });

  it("400 on invalid body", async () => {
    const req = new Request("http://localhost/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "",
        email: "not an email",
        website: "not a website",
      }),
    });

    const res = await createTenant(req);
    expect(res.status).toBe(400);
  });

  it("409 on duplicate email", async () => {
    const uniq = Date.now();
    const data = {
      name: "Dup",
      email: `dup-${uniq}@x.local`,
      website: `https://dup-${uniq}.example`,
    };

    await prisma.tenants.create({ data });

    const req = new Request("http://localhost/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const res = await createTenant(req);
    expect(res.status).toBe(409);
  });
});
