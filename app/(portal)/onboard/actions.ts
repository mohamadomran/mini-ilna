"use server";

import { revalidatePath } from "next/cache";

export async function onboardTenant(input: {
  name: string;
  email: string;
  website: string;
}) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/tenants`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => {});
    throw new Error(err?.error ?? `Failed to create tenant (${res.status})`);
  }

  const { id } = await res.json();

  revalidatePath("/(portal)/bookings");

  return { id };
}
