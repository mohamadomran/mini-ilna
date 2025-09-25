"use client";

import { FormEvent, useState } from "react";
import { createTenantAction } from "./actions";
import Link from "next/link";

export default function OnboardPage() {
  const [status, setStatus] = useState<
    "idle" | "submitting" | "done" | "error"
  >("idle");

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErr(null);
    setTenantId(null);

    const form = new FormData(e.currentTarget);
    const res = await createTenantAction(form);

    if (res.ok && res.id) {
      setTenantId(res.id);
      setStatus("done");
    } else {
      setErr(res.error || "Something went wrong..");
      setStatus("error");
    }
  }

  return (
    <div className="max-w-2xl ">
      <h1 className="text-2xl font-semibold">Onboard a business</h1>
      <p className="text-sm text-slate-500">
        Fill in the details. On submit we create a tenant and kick off ingestion
        from the included fixture.
      </p>

      <form onSubmit={onSubmit} className="card-space-y-4">
        <div className="mt-4 mb-4">
          <label className="block text-md mb-4">Business Name</label>
          <input
            name="name"
            className="input"
            placeholder="Serenity Spa"
            required
          />
        </div>

        <div className="mt-4 mb-4">
          <label className="block text-md mb-4">Contact Email</label>
          <input
            name="email"
            type="email"
            className="input"
            placeholder="owner@example.com"
            required
          />
        </div>

        <div className="mt-4 mb-4">
          <label className="block text-md mb-4">Website URL</label>
          <input
            name="website"
            className="input"
            placeholder="https://serenity.example"
            required
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            className="btn btn-priamry"
            disabled={status === "submitting"}
          >
            {status === "submitting" ? "Creating..." : "Create Tenant"}
          </button>
          <span className="text-xs text-slate-500">
            This will also start data ingestion
          </span>
        </div>

        {status === "done" && tenantId && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
            Ingestion started for <code className="font-mono">{tenantId}</code>
            <Link href={`/bookings?tenantId=${tenantId}`} className="underline">
              {" "}
              Go to Bookings
            </Link>
          </div>
        )}

        {status === "error" && err && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {err}
          </div>
        )}
      </form>
    </div>
  );
}
