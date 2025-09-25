# Mini-ilna Full-Stack Assignment

A small vertical slice of the **ilna AI product** implemented in **Next.js + Prisma + SQLite** that demonstrates end-to-end ownership of the stack:

- Tenant onboarding
- Website ingestion from fixture HTML
- FAQ retrieval via TF-IDF
- WhatsApp-like chat for bookings & payments
- Bookings & invoices portal (desktop web)
- Quiet Hours throttling
- Localised UI (English ↔ Arabic, RTL-aware)

---

## Features

✅ **Tenant onboarding**

- One form: `name`, `email`, `website`
- Persists the tenant then immediately kicks off ingestion from `fixtures/website.html`

✅ **Knowledge ingestion**

- Parses fixture HTML → clean text
- Splits into ~700-char overlapping chunks (100 char overlap to preserve context)
- Stores per-chunk term frequencies at `kb_chunks.meta.tf`
- Endpoints: `/api/kb/ingest`, `/api/kb/search`

✅ **Retrieval**

- Lightweight TF-IDF ranker (`rankChunksByTfIdf`)
- `GET /api/kb/search?q=…&tenantId=…` → up to 3 passages with scores (returns an empty array when nothing matches)

✅ **WhatsApp-like inbound**

- `POST /api/channels/wa/inbound` with `{ tenantId, from, text }`
- Regex classifier → **faq | booking | payment**
  - **FAQ** → highest-ranked passage (≤200 chars) + `chunkId`
  - **Booking** → parses time (`parseWhen`) & service, creates booking, returns ISO start time + human reply
  - **Payment** → creates invoice (`pending`), fills fake paylink, returns paylink metadata
- **Quiet Hours**: when enabled the endpoint replies `{ type: "quiet", reply }` and skips any side-effects

✅ **Portal** (`/{locale}/…`)

- `/{locale}/onboard` — create a tenant, auto-ingest KB
- `/{locale}/bookings?tenantId=…` — control centre:
  - **Chat simulator** with quick prompts
  - **Bookings table** (start, service, phone, created)
  - **Invoices table** (amount, status: pending/sent/paid, paylink)
  - **Actions**: send/re-send paylink, mark paid, re-ingest KB
- `/{locale}/pay/:id` — simple pay page; “Pay now” flips status → `paid`
- Header includes locale switcher (EN/AR) and updates layout direction (LTR/RTL)

---

## Tech Stack

- **Frontend:** Next.js 15 (App Router), Next-Intl, TailwindCSS
- **Backend:** Next.js Route Handlers + Server Actions
- **DB:** SQLite (Prisma)
- **Tests:** Vitest (API happy-path + edge cases)
- **Styling:** Tailwind utility classes + lightweight design tokens

---

## Data Model (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model tenants {
  id         String      @id @default(cuid())
  name       String
  email      String      @unique
  website    String      @unique
  created_at DateTime    @default(now())

  kb_chunks  kb_chunks[]
  bookings   bookings[]
  invoices   invoices[]

  @@index([email])
  @@index([website])
}

model kb_chunks {
  id         String   @id @default(cuid())
  tenant_id  String
  text       String
  meta       Json
  created_at DateTime @default(now())

  tenant     tenants  @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

  @@index([tenant_id])
}

model bookings {
  id             String   @id @default(cuid())
  tenant_id      String
  service        String
  start_time     DateTime
  customer_phone String
  source         String   @default("wa")
  created_at     DateTime @default(now())

  tenant         tenants  @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, start_time])
}

enum InvoiceStatus {
  pending
  sent
  paid
}

model invoices {
  id             String        @id @default(cuid())
  tenant_id      String
  amount         Int
  currency       String        @default("AED")
  status         InvoiceStatus @default(pending)
  paylink        String
  customer_phone String
  created_at     DateTime      @default(now())

  tenant         tenants       @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, status])
}
```

---

## API Endpoints

### Tenants

- `POST /api/tenants` → `{ id }`
  - Validates payload, creates tenant, fire-and-forget triggers `POST /api/kb/ingest?tenantId=…`

### Knowledge Base

- `POST /api/kb/ingest?tenantId=…` → `{ chunks: n }`
  - Replaces existing knowledge with fresh chunks from the fixture
- `GET /api/kb/search?q=…&tenantId=…` → `[{ id, text, score }]`
  - Returns `[]` when the tenant has no knowledge or nothing matches

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
- `POST /api/invoices/:id/mark-paid` → `{ ok: true, status, tenantId }`
- `GET /api/invoices/:id/mark-paid?next=/…` → redirects or returns JSON `{ ok, status, tenantId }`
- App route: `/{locale}/pay/:id` → simulate payment (`POST` form → mark invoice `paid`)

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
- To test different timezones, change `QUIET_HOURS_TZ` and restart the dev server.

---

## Setup & DX

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

- Onboarding: http://localhost:3000/en/onboard (locale switcher toggles EN ↔ AR)
- Portal: http://localhost:3000/en/bookings?tenantId=…
- Pay page: http://localhost:3000/en/pay/:invoiceId

> Tip: after onboarding, the success toast reveals the tenant ID. Use it in the `/bookings` query string.

---

## Sample cURL

```bash
# Create tenant
curl -s -X POST http://localhost:3000/api/tenants \
  -H 'content-type: application/json' \
  -d '{"name":"Serenity Spa","email":"owner@serenity.local","website":"https://serenity.example"}'

# Ingest KB
curl -s "http://localhost:3000/api/kb/ingest?tenantId=<TENANT_ID>"

# Ask a question
curl -s -X POST http://localhost:3000/api/channels/wa/inbound \
  -H 'content-type: application/json' \
  -d '{"tenantId":"<TENANT_ID>","from":"+971500000001","text":"What are your opening hours?"}'

# Mark an invoice paid
curl -s -X POST http://localhost:3000/api/invoices/<INVOICE_ID>/mark-paid
```

---

## Tests

```bash
pnpm test
```

Covers:

- **FAQ flow:** TF-IDF ranking returns a relevant passage
- **Booking flow:** WhatsApp booking persists and returns an ISO start time
- **Payment flow:** Invoice creation + `/send` status flip + `/mark-paid` status flip
- **KB search edge case:** empty knowledge returns `[]`
- **Health checks / DB reset helpers**

---

## Re-ingest / Inspect / Reset

- Re-ingest from the **Bookings** page (button) or via cURL:
  ```bash
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

- **Transparent ranking:** TF-IDF keeps retrieval simple & explainable.
- **Regex intent detection:** fast to iterate on; upgrade path to ML when needed.
- **Server actions:** wrap fetch-based API calls so the portal stays server-rendered while reusing route handlers.
- **Internationalisation:** Next-Intl handles routing, translations, and RTL styling with a single config file.
