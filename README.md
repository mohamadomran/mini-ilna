# Mini-ilna Full-Stack Assignment

A small vertical slice of the **ilna AI product** implemented in **Next.js + Prisma + SQLite**.
Demonstrates end-to-end ownership of the stack:

- Tenant onboarding
- Website ingestion from fixture HTML
- FAQ retrieval via TF-IDF
- WhatsApp-like chat for bookings & payments
- Bookings & Invoices portal
- Quiet Hours

---

## Features

✅ **Tenant onboarding**

- One form: `name`, `email`, `website`
- Persists tenant, immediately kicks off ingestion from `fixtures/website.html`

✅ **Knowledge ingestion**

- Parses fixture HTML → clean text
- Splits into ~700-char overlapping chunks (+ small overlap to preserve context)
- Stores per-chunk term frequencies at `kb_chunks.meta.tf`
- Endpoints: `/api/kb/ingest`, `/api/kb/search`

✅ **Retrieval**

- Lightweight TF-IDF ranker (`rankChunksByTfIdf`)
- `GET /api/kb/search?q=…&tenantId=…` → top 3 passages with scores

✅ **WhatsApp-like inbound**

- `POST /api/channels/wa/inbound` with `{ tenantId, from, text }`
- Regex classifier → **faq | booking | payment**
  - **FAQ** → best passage (≤200 chars) + `chunkId`
  - **Booking** → parses time (`parseWhen`) & service name, creates booking, returns ISO time + human message
  - **Payment** → creates invoice (`pending`), attaches fake paylink, returns paylink
- **Quiet Hours**: if enabled, replies with a configurable message instead of acting

✅ **Portal**

- `/onboard` — create a tenant, auto-ingest KB
- `/bookings?tenantId=…` — the control center:
  - **Chat simulator** (WhatsApp-like) with quick prompts
  - **Bookings table** (start, service, phone, created)
  - **Invoices table** (amount, status: pending/sent/paid, paylink)
  - **Actions**: send/re-send paylink, mark paid, re-ingest KB
- `/pay/:id` — simple pay page; “Pay now” flips status → `paid`

---

## Tech Stack

- **Frontend:** Next.js 15 (App Router), TailwindCSS
- **Backend:** Next.js Route Handlers + Server Actions
- **DB:** SQLite (Prisma)
- **Tests:** Vitest (API happy-path tests)
- **Styling:** Tailwind utility classes + tiny design system (buttons, inputs, cards)

---

## Data Model (Prisma)

```prisma
model tenants {
  id         String     @id @default(cuid())
  name       String
  email      String
  website    String     @unique
  created_at DateTime   @default(now())
  bookings   bookings[]
  invoices   invoices[]
  kb_chunks  kb_chunks[]
}

model kb_chunks {
  id         String   @id @default(cuid())
  tenant_id  String
  text       String
  meta       Json
  created_at DateTime @default(now())
  tenant     tenants  @relation(fields: [tenant_id], references: [id])
}

model bookings {
  id             String   @id @default(cuid())
  tenant_id      String
  service        String
  start_time     DateTime
  customer_phone String
  source         String
  created_at     DateTime @default(now())
  tenant         tenants  @relation(fields: [tenant_id], references: [id])
}

model invoices {
  id             String   @id @default(cuid())
  tenant_id      String
  amount         Int
  currency       String
  status         String   // pending | sent | paid | quiet
  paylink        String
  customer_phone String
  created_at     DateTime @default(now())
  tenant         tenants  @relation(fields: [tenant_id], references: [id])
}
```

---

## Endpoints

### Tenants

- `POST /api/tenants` → `{ id }`
  Triggers ingestion for that tenant.

### Knowledge Base

- `POST /api/kb/ingest?tenantId=…` → `{ chunks: n }`
- `GET  /api/kb/search?q=…&tenantId=…` → `[{ id, text, score }]`

### WhatsApp Inbound

- `POST /api/channels/wa/inbound`
  - **Input:** `{ tenantId, from, text }`
  - **Output:**
    - FAQ → `{ type: "faq", reply, chunkId }`
    - Booking → `{ type: "booking", bookingId, start, reply }`
    - Payment → `{ type: "payment", invoiceId, paylink, reply }`
    - Quiet → `{ type: "quiet", reply }`

### Invoices

- `POST /api/invoices/:id/send` → `{ type: "sent", paylink, status }`
- `POST /api/invoices/:id/pay` → `{ type: "paid", status }`

---

## Quiet Hours

Optional throttle that defers replies during certain local hours.

**Env vars:**

```
QUIET_HOURS_ENABLED=true
QUIET_HOURS_START=20:00        # 24h format
QUIET_HOURS_END=08:00
QUIET_HOURS_TZ=Asia/Dubai      # IANA timezone
```

- When active, `/api/channels/wa/inbound` returns `{ type: "quiet", reply }` without creating bookings or invoices.
- To test different timezones, change `QUIET_HOURS_TZ` and restart dev server.

---

## Setup

```bash
# Install deps
pnpm install

# Create DB + run migrations (prisma/dev.db)
pnpm db:migrate

# (Optional) reset DB from scratch
rm -f prisma/dev.db && pnpm db:migrate

# Start dev server
pnpm dev
```

Visit:

- Onboarding: http://localhost:3000/onboard
- Portal: http://localhost:3000/bookings?tenantId=…

> Tip: After onboarding, the page shows the new tenant ID. Use it in the `/bookings` URL.

---

## Usage Flow

1. **Onboard**

   - Fill out the form, submit → ingestion runs from `fixtures/website.html`.

2. **Chat**

   - Go to `/bookings?tenantId=…`
   - Try:
     - `What are your opening hours?` → FAQ passage
     - `I'd like a 60m massage tomorrow after 3pm` → booking
     - `Can I pay a deposit now?` → paylink

3. **Bookings / Invoices**

   - New booking appears instantly (Chat triggers `router.refresh()`).
   - Create/send paylinks; mark invoices as paid.
   - Re-ingest KB with one click.

4. **Pay Page**
   - Open paylink → `/pay/:id` → “Pay now” flips status to `paid`.

---

## Sample cURL

```bash
# Create tenant
curl -s -X POST http://localhost:3000/api/tenants   -H 'content-type: application/json'   -d '{"name":"Serenity Spa","email":"owner@serenity.local","website":"https://serenity.example"}'

# Ingest KB
curl -s "http://localhost:3000/api/kb/ingest?tenantId=<TENANT_ID>"

# Ask a question
curl -s -X POST http://localhost:3000/api/channels/wa/inbound   -H 'content-type: application/json'   -d '{"tenantId":"<TENANT_ID>","from":"+971500000001","text":"What are your opening hours?"}'
```

---

## Tests

```bash
pnpm test
```

Covers:

- **FAQ flow:** returns relevant passage
- **Booking flow:** row persisted; ISO start ~tomorrow 15–18h
- **Payment flow:** invoice creation; `/send` flips to `sent`; paylink returned

---

## Re-ingest / Inspect / Reset

- Re-ingest from the **Bookings** page (button) or:
  ```
  curl -s "http://localhost:3000/api/kb/ingest?tenantId=<TENANT_ID>"
  ```
- Inspect DB:
  ```bash
  pnpm dlx prisma studio
  ```
- Reset DB:
  ```bash
  rm -f prisma/dev.db && pnpm db:migrate
  ```

---

## Design Notes

- **Simple, testable ranking:** TF-IDF is transparent and sufficient for a small fixture.
- **Regex intent detection:** fast and clear; upgrade path to an ML
