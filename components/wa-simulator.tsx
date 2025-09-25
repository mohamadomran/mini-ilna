"use client";

import { useState } from "react";

type Props = { tenantId: string };

export default function WebSimulator({ tenantId }: Props) {
  const [text, setText] = useState("What are your opening hours?");
  const [from, setFrom] = useState("+971500000001");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(kind?: "faq" | "booking" | "payment") {
    setError(null);
    setResult(null);
    setLoading(true);

    const message =
      kind === "booking"
        ? "I'd like a 60m massage tomorrow after 3pm"
        : kind === "payment"
        ? "Can I pay a deposit now with my card?"
        : text;

    try {
      const res = await fetch("/api/channels/wa/inbound", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, from, text: message }),
      });

      const body = await res.json().catch(() => {});
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setResult(body);
    } catch (e: any) {
      setError(e.message || "Failed to send");
    }
  }

  async function reIngest() {
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/kb/ingest?tenantId=${tenantId}`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setResult({ type: "ingest", ...body });
    } catch (e: any) {
      setError(e.message || "Ingest failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">WhatsApp Simulator</h3>
        <button
          className="btn btn-secondary"
          onClick={reIngest}
          disabled={loading}
          title="Re-ingest fixtures/website.html for this tenant"
        >
          {loading ? "…" : "Re-ingest fixture"}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          From (phone)
          <input
            className="input mt-1 w-full"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>

        <label className="text-sm sm:col-span-2">
          Message
          <textarea
            className="input mt-1 w-full h-24"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-primary"
          onClick={() => send()}
          disabled={loading}
        >
          {loading ? "Sending…" : "Send"}
        </button>
        <button
          className="btn"
          onClick={() => send("booking")}
          disabled={loading}
        >
          Booking example
        </button>
        <button
          className="btn"
          onClick={() => send("payment")}
          disabled={loading}
        >
          Payment example
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/40">
          <pre className="whitespace-pre-wrap break-words">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
