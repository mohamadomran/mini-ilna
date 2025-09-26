import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { htmlToText, splitIntoChunks, termFreq } from "@/lib/chunk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  let html: string;

  if (!tenantId)
    return NextResponse.json(
      { error: "tenantId is required" },
      { status: 400 }
    );

  const tenant = await prisma.tenants.findUnique({ where: { id: tenantId } });
  if (!tenant)
    return NextResponse.json({ error: "tenant not found" }, { status: 404 });

  const filePath = path.join(process.cwd(), "fixtures", "website.html");

  try {
    html = await fs.readFile(filePath, "utf-8");
  } catch {
    return NextResponse.json(
      { error: `Fixture not found at ${filePath}` },
      { status: 404 }
    );
  }

  const text = htmlToText(html);
  const chunks = splitIntoChunks(text, 420, {
    minChars: 180,
    overlapChars: 80,
  });

  if (chunks.length === 0)
    return NextResponse.json({ error: "No chunks extracted" }, { status: 422 });

  await prisma.kb_chunks.deleteMany({ where: { tenant_id: tenantId } });

  const data = chunks.map((c) => ({
    tenant_id: tenantId,
    text: c,
    meta: { tf: termFreq(c) },
  }));

  const inserted = await prisma.kb_chunks.createMany({ data });

  return NextResponse.json({ chunks: inserted.count }, { status: 200 });
}
