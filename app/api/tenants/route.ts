// app/api/tenants/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { TenantCreateSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = TenantCreateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, website } = parsed.data;

    try {
      const tenant = await prisma.tenants.create({
        data: { name, email, website },
        select: { id: true },
      });

      // Build absolute URL for server-side fetch
      const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin;

      // Fire-and-forget ingestion kickoff (skip during tests)
      if (process.env.NODE_ENV !== "test") {
        void fetch(`${base}/api/kb/ingest?tenantId=${tenant.id}`, {
          method: "POST",
        }).catch(() => {
          // swallow background errors to avoid noisy logs
        });
      }

      return NextResponse.json({ id: tenant.id }, { status: 201 });
    } catch (err: any) {
      if (err?.code === "P2002") {
        const fields = Array.isArray(err?.meta?.target)
          ? err.meta.target.join(", ")
          : "unique field";
        return NextResponse.json(
          { error: `Tenant with this ${fields} already exists` },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
