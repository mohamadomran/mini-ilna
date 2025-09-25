import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { rankChunksByTfIdf } from "@/lib/rank";
import { parseWhen } from "@/lib/when";
import {
  loadQuietHoursFromEnv,
  isWithinQuietHours,
  buildQuietHoursMessage,
} from "@/lib/quiet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const InboundMessageSchema = z.object({
  tenantId: z.string().min(1),
  from: z.string().min(1),
  text: z.string().min(1),
});

type InboundMessage = z.infer<typeof InboundMessageSchema>;
export type InboundKind = "faq" | "booking" | "payment";

export function classifyText(input: string): InboundKind {
  const s = input.toLowerCase();

  if (/(pay|deposit|card|payment|visa|mastercard)/i.test(s)) return "payment";
  if (
    /(book|booking|appointment|appt|massage|hair|facial|slot|reserve|schedule)/i.test(
      s
    )
  ) {
    return "booking";
  }
  return "faq";
}

function truncate(str: string, max = 200): string {
  if (str.length <= max) return str;

  const cut = str.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 120 ? cut.slice(0, lastSpace) : cut) + "...";
}

function extractService(text: string): string {
  const t = text.toLowerCase();
  const minutes = t.match(/\b(\d{1,3})\s*(?:m|min|mins|minute|minutes)\b/);
  const hours = t.match(/\b(\d{1,2})\s*(?:h|hr|hrs|hour|hours)\b/);

  let normDur: string | null = null;
  if (minutes) normDur = `${parseInt(minutes[1], 10)}m`;
  else if (hours) normDur = `${parseInt(hours[1], 10) * 60}m`;

  const has = (re: RegExp) => re.test(t);

  let service: string | null = null;
  if (has(/massage/)) service = "massage";
  else if (has(/facial/)) service = "facial";
  else if (has(/hair(cut| ?style| ?color)?|blow ?dry/)) service = "hair";
  else if (has(/manicure|pedicure|nails?/)) service = "nails";
  else if (has(/spa|treatment/)) service = "treatment";
  else if (
    has(/(?:^|\s)(book|booking|appointment|appt|reserve|schedule|slot)(?:\s|$)/)
  )
    service = "appointment";

  if (!service) return "general";
  return normDur ? `${normDur} ${service}` : service;
}

export async function POST(req: Request) {
  let payload: InboundMessage;
  const quietHoursConfig = loadQuietHoursFromEnv();

  if (isWithinQuietHours(new Date(), quietHoursConfig)) {
    return NextResponse.json(
      {
        type: "quiet",
        reply: buildQuietHoursMessage(quietHoursConfig),
      },
      { status: 200 }
    );
  }

  try {
    const json = await req.json();
    const parsed = InboundMessageSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid body",
          details: parsed.error.flatten,
        },
        { status: 400 }
      );
    }
    payload = parsed.data;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { tenantId, from, text } = payload;
  const kind = classifyText(text);

  if (kind === "faq") {
    const chunks = await prisma.kb_chunks.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, text: true, meta: true },
    });

    if (chunks.length === 0) {
      return NextResponse.json(
        {
          type: "faq",
          reply:
            "I couldn't find any knowledge for this tenant yet. Try ingesting the website first..",
        },
        { status: 200 }
      );
    }

    const ranked = rankChunksByTfIdf(chunks, text, 1);

    if (ranked.length === 0) {
      return NextResponse.json(
        {
          type: "faq",
          reply:
            "Sorry, I couldn't find a relevant passage for that question right now",
        },
        { status: 200 }
      );
    }

    const top = ranked[0];
    const reply = truncate(top.text, 200);

    return NextResponse.json(
      {
        type: "faq",
        reply,
        chunkId: top.id,
      },
      { status: 200 }
    );
  }

  if (kind === "booking") {
    const start = parseWhen(text);
    const service = extractService(text);

    const booking = await prisma.bookings.create({
      data: {
        tenant_id: tenantId,
        service,
        start_time: start,
        customer_phone: from,
        source: "wa",
      },
      select: { id: true, start_time: true, service: true },
    });

    const startLocal = new Date(
      booking.start_time.getTime() - new Date().getTimezoneOffset() * 60000
    )
      .toISOString()
      .replace("T", " ")
      .slice(0, 16);

    return NextResponse.json(
      {
        type: "booking",
        bookingId: booking.id,
        start: booking.start_time.toISOString(),
        reply: `Booked ${booking.service} at ${startLocal}`,
      },
      { status: 200 }
    );
  }

  if (kind === "payment") {
    // for demo purpose
    const amount = 100;
    const paylinkBase =
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const created = await prisma.invoices.create({
      data: {
        tenant_id: tenantId,
        amount,
        currency: "AED",
        status: "pending",
        paylink: "",
        customer_phone: from,
      },
      select: { id: true },
    });

    const link = `${paylinkBase}/pay/${created.id}`;
    const invoice = await prisma.invoices.update({
      where: { id: created.id },
      data: { paylink: link },
      select: { id: true, status: true, paylink: true },
    });

    return NextResponse.json(
      {
        type: "payment",
        invoiceId: invoice.id,
        paylink: invoice.paylink,
        reply: `You can pay securely here: ${invoice.paylink}`,
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ error: "Unhandled type" }, { status: 400 });
}
