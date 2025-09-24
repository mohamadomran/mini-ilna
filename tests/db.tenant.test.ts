import { describe, it, expect } from "vitest";
import { prisma } from "../lib/db";

describe("prisma tenants", () => {
  it("creates and reads a tenant", async () => {
    const created = await prisma.tenants.create({
      data: {
        name: "Serenity Spa & Wellness",
        email: "hello@serenity.example",
        website: "https://acme.spa",
      },
    });

    const found = await prisma.tenants.findUnique({
      where: { id: created.id },
    });

    expect(found?.email).toBe("hello@serenity.example");
    expect(found?.name).toBe("Serenity Spa & Wellness");
  });
});
