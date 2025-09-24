import { prisma } from "@/lib/db";

async function main() {
  const tenant = await prisma.tenants.upsert({
    where: { email: "demo@tenant.local" },
    update: {},
    create: {
      name: "Demo Tenant",
      email: "demo@tenant.local",
      website: "https://example.com",
    },
  });

  console.log("Seeded tenant:", tenant.id);
}

main()
  .catch((e) => {
    console.log(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
