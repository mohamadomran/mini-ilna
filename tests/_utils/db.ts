import { prisma } from "../../lib/db";

export async function resetDb() {
  await prisma.invoices.deleteMany();
  await prisma.bookings.deleteMany();
  await prisma.kb_chunks.deleteMany();
  await prisma.tenants.deleteMany();
}
