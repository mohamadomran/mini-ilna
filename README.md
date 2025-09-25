# Mini-ilna Full-Stack Assignment

A small vertical slice of the **ilna AI product** implemented in **Next.js + Prisma + SQLite**.
Demonstrates end-to-end ownership of the stack:

- Tenant onboarding
- Website ingestion from fixture HTML
- FAQ retrieval via TF-IDF
- WhatsApp-like chat for bookings & payments
- Bookings and Invoices portal

---

## Features

✅ **Tenant onboarding**

- Simple form: `name`, `email`, `website`.
- Creates a tenant row in DB.
- Immediately kicks off ingestion from `fixtures/website.html`.

✅ **Knowledge ingestion**

- Reads static fixture HTML (`fixtures/website.html`).
- Converts to clean text, splits into ~700-character overlapping chunks.
- Stores chunks + per-chunk term frequencies (`meta.tf`) in `kb_chunks`.
- Provides `/api/kb/ingest` and `/api/kb/search`.

✅ **Retrieval**

- Uses a lightweight TF-IDF-like ranking (`rankChunksByTfIdf`).
- `/api/kb/search?q=…&tenantId=…` returns top 3 relevant passages with scores.

✅ **WhatsApp inbound simulation**

- `POST /api/channels/wa/inbound` accepts `{ tenantId, from, text }`.
- Classifies text into **FAQ | booking | payment** using regexes.
- Behaviors:
  - **FAQ** → returns best KB passage (≤200 chars) with `chunkId`.
  - **Booking** → parses time via `parseWhen()`, stores booking row, returns ISO time.
  - **Payment** → creates invoice, sets `status=pending`, attaches fake paylink, returns paylink.

✅ **Bookings portal**

- `/bookings?tenantId=…`
- Shows:
  - **Chat simulator** (WhatsApp-like, stateful, quick buttons for FAQ/Booking/Payment).
  - **Bookings table** (upcoming bookings with service, start, customer).
  - **Invoices table** (invoices with status: pending, sent, paid).
- Server Actions allow:
  - Create + send paylink
  - Re-send existing invoice
  - Mark invoice as paid
  - Re-ingest KB chunks for a tenant

✅ **Paylink simulation**

- `/pay/:id` page displays invoice details.
- "Pay now (simulate)" flips invoice status → `paid` and shows success message.

---

## Tech Stack

- **Frontend:** Next.js 15, App Router, TailwindCSS
- **Backend:** Next.js server actions, REST endpoints
- **Database:** SQLite with Prisma ORM
- **Testing:** Vitest for API tests (`tests/wa.booking.api.test.ts`, etc.)
- **Styling:** Tailwind utility classes + minimal UI components

---

## Data Model

Tables in `prisma/schema.prisma`:

```prisma
model tenants {
  id        String   @id @default(cuid())
  name      String
  email     String
  website   String   @unique
  created_at DateTime @default(now())
  bookings   bookings[]
  invoices   invoices[]
  kb_chunks  kb_chunks[]
}

model kb_chunks {
  id        String   @id @default(cuid())
  tenant_id String
  text      String
  meta      Json
  created_at DateTime @default(now())
  tenant    tenants @relation(fields: [tenant_id], references: [id])
}

model bookings {
  id             String   @id @default(cuid())
  tenant_id      String
  service        String
  start_time     DateTime
  customer_phone String
  source         String
  created_at     DateTime @default(now())
  tenant         tenants @relation(fields: [tenant_id], references: [id])
}

model invoices {
  id             String   @id @default(cuid())
  tenant_id      String
  amount         Int
  currency       String
  status         String
  paylink        String
  customer_phone String
  created_at     DateTime @default(now())
  tenant         tenants @relation(fields: [tenant_id], references: [id])
}
```

---

## Endpoints

### Tenants

- `POST /api/tenants` → `{ id }`

### Knowledge base

- `POST /api/kb/ingest?tenantId=…` → `{ chunks: n }`
- `GET /api/kb/search?q=…&tenantId=…` → `[{ id, text, score }]`

### WhatsApp inbound

- `POST /api/channels/wa/inbound`
  - Input: `{ tenantId, from, text }`
  - Output depends on intent:
    - FAQ → `{ type: "faq", reply, chunkId }`
    - Booking → `{ type: "booking", bookingId, start, reply }`
    - Payment → `{ type: "payment", invoiceId, paylink, reply }`

### Invoices

- `POST /api/invoices/:id/send` → `{ type: "sent", paylink, status }`
- `POST /api/invoices/:id/pay` → `{ type: "paid", status }`

---

## Portal Pages

- `/onboard`
  - Form for tenant creation
  - Auto-triggers ingestion from fixture
- `/bookings?tenantId=…`
  - Chat simulator
  - Bookings table
  - Invoices table
  - Re-ingest button
- `/pay/:id`
  - Invoice detail + simulate payment

---

## Setup

```bash
# Install deps
pnpm install

# Run migrations (creates prisma/dev.db)
pnpm db:migrate

# (Optional) reset database
rm -f prisma/dev.db && pnpm db:migrate

# Start dev server
pnpm dev
```

Visit: [http://localhost:3000/onboard](http://localhost:3000/onboard)

---

## Usage Flow

1. **Onboard a tenant**

   - Fill name/email/website
   - Ingestion runs automatically

2. **Chat simulator**

   - Open `/bookings?tenantId=…`
   - Send prompts:
     - `"What are your opening hours?"` → FAQ reply from KB
     - `"I'd like a 60m massage tomorrow after 3pm"` → Creates booking
     - `"Can I pay a deposit now?"` → Creates invoice + paylink

3. **Bookings table**

   - See your new booking row

4. **Invoices table**

   - Shows pending/sent invoices
   - Buttons: "Send", "Mark paid"
   - Clicking paylink opens `/pay/:id`

5. **Pay simulation**
   - `/pay/:id` → press "Pay now"
   - Invoice marked as `paid`

---

## Tests

Run vitest tests:

```bash
pnpm test
```

Core tests include:

- **FAQ flow**: retrieval of passage
- **Booking flow**: booking row creation, ISO start time ~tomorrow 15–18h
- **Payment flow**: invoice creation, send, paylink correctness

---

## Design Notes & Tradeoffs

- **Clarity > completeness**
  Time-boxed (6–8h). Minimal but end-to-end.
- **Ingestion heuristic**
  Basic HTML → text → 700-char chunks. Works on fixture, not robust to arbitrary web.
- **Ranking**
  TF-IDF-ish scoring; enough to retrieve relevant snippets from fixture.
- **Regex intent detection**
  Simple rules: `/(pay|deposit|card)/`, `/(book|massage|hair|facial)/`, else FAQ.
- **Chat simulator vs buttons**
  Both provided; chat shows more realistic flow, tables give admin actions.
- **Persistence**
  SQLite chosen for simplicity, Prisma migrations for schema.

---

## What I'd Build Next

- Usage counters per tenant (messages, bookings).
- Richer booking parser (natural language date/time, services).
- Real integrations (Twilio WhatsApp, Stripe payment).
- Authentication + per-tenant dashboard.

---

## Screenshots

_(Add here screenshots of Onboarding, Bookings, Chat, Invoices, Pay page for clarity)_

---
