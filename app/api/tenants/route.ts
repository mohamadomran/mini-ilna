import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { TenantCreateSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = TenantCreateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid Body", details: parsed.error },
        { status: 400 }
      );
    }

    const { name, email, website } = parsed.data;

    try {
      const tenant = await prisma.tenants.create({
        data: { name, email, website },
        select: { id: true },
      });

      const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin;

      if (process.env.NODE_ENV !== "test")
        fetch(`${base}/api/kb/ingest?tenantId=${tenant.id}`, {
          method: "POST",
        });

      return NextResponse.json({ id: tenant.id }, { status: 201 });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return NextResponse.json(
          {
            error: "Tenant with this email already exists",
          },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
