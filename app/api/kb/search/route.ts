import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rankChunksByTfIdf } from "@/lib/rank";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = (url.searchParams.get("q") || "").trim();
  const tenantId = url.searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
  }

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const chunks = await prisma.kb_chunks.findMany({
    where: { tenant_id: tenantId },
    select: { id: true, text: true, meta: true },
  });

  if (chunks.length === 0) {
    return NextResponse.json([], { status: 200 });
  }

  const ranked = rankChunksByTfIdf(chunks, query, 3);

  const results = ranked.map(({ id, text, score }) => ({ id, text, score }));

  return NextResponse.json(results, { status: 200 });
}
