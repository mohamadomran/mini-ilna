"use server";

type CreateResult = { ok: boolean; id?: string; error?: string };

export async function createTenantAction(
  formData: FormData
): Promise<CreateResult> {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const website = String(formData.get("website") || "").trim();

  if (!name || !email || !website) {
    return { ok: false, error: "All fields are required" };
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  try {
    const res = await fetch(`${base}/api/tenants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, website }),
      cache: "no-store",
    });

    if (!res.ok) {
      const j = await res.json().catch(() => {});
      return { ok: false, error: j.error || `Request failed (${res.status})` };
    }

    const j = (await res.json()) as { id: string };
    return { ok: true, id: j.id };
  } catch (e: any) {
    return { ok: false, error: e.message || "Network error" };
  }
}
