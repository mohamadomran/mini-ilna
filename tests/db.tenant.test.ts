import { describe, it, expect } from "vitest";
import { prisma } from "../lib/db";
import { resetDb } from "./_utils/db";

describe("prisma tenants", () => {
  beforeEach(resetDb);

  it("creates and reads a tenant", async () => {
    const uniq = Date.now();

    const created = await prisma.tenants.create({
      data: {
        name: "Serenity Spa & Wellness",
        email: `owner-${uniq}@serenity.example`,
        website: `https://serenity-${uniq}.spa`,
      },
    });

    const found = await prisma.tenants.findUnique({
      where: { id: created.id },
    });

    expect(found?.email).toBe(`owner-${uniq}@serenity.example`);
  });
});
