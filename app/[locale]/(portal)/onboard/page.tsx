"use client";

import { FormEvent, useState } from "react";
import { createTenantAction } from "./actions";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

export default function OnboardPage() {
  const locale = useLocale();
  const t = useTranslations("onboard");
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
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-slate-500">{t("description")}</p>

      <form onSubmit={onSubmit} className="card-space-y-4">
        <div className="mt-4 mb-4">
          <label className="block text-md mb-4">{t("fields.name.label")}</label>
          <input
            name="name"
            className="input"
            placeholder={t("fields.name.placeholder")}
            required
          />
        </div>

        <div className="mt-4 mb-4">
          <label className="block text-md mb-4">{t("fields.email.label")}</label>
          <input
            name="email"
            type="email"
            className="input"
            placeholder={t("fields.email.placeholder")}
            required
          />
        </div>

        <div className="mt-4 mb-4">
          <label className="block text-md mb-4">{t("fields.website.label")}</label>
          <input
            name="website"
            className="input"
            placeholder={t("fields.website.placeholder")}
            required
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            className="btn btn-priamry"
            disabled={status === "submitting"}
          >
            {status === "submitting"
              ? t("actions.submit.loading")
              : t("actions.submit.idle")}
          </button>
          <span className="text-xs text-slate-500">
            {t("actions.submit.hint")}
          </span>
        </div>

        {status === "done" && tenantId && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
            {t("success.message")}{" "}
            <code className="font-mono">{tenantId}</code>
            <Link
              href={`/${locale}/bookings?tenantId=${tenantId}`}
              className="underline"
            >
              {" "}
              {t("success.cta")}
            </Link>
          </div>
        )}

        {status === "error" && err && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {err || t("error.generic")}
          </div>
        )}
      </form>
    </div>
  );
}
