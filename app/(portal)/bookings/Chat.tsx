"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type BotType = "faq" | "booking" | "payment" | "quiet";

type Message =
  | { role: "user"; text: string }
  | {
      role: "bot";
      text: string;
      type: BotType;
      invoiceId?: string;
      paylink?: string;
    };

export default function Chat({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [from, setFrom] = useState("+971500000001");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  async function send() {
    if (!text.trim() || sending) return;

    const user = text.trim();
    setMessages((m) => [...m, { role: "user", text: user }]);
    setText("");
    setSending(true);

    try {
      const res = await fetch("/api/channels/wa/inbound", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, from, text: user }),
        cache: "no-store",
      });

      const raw = await res.text(); // read as text first
      let body: any = null;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        /* not JSON */
      }

      if (!res.ok) {
        const msg =
          (body && (body.error || body.message)) ||
          raw?.slice(0, 200) ||
          `HTTP ${res.status}`;
        setMessages((m) => [
          ...m,
          { role: "bot", text: `Error: ${msg}`, type: "faq" },
        ]);
        return;
      }

      const bot = {
        role: "bot" as const,
        text: body?.reply ?? "OK",
        type: body?.type ?? "faq",
        invoiceId: body?.invoiceId,
        paylink: body?.paylink,
      };
      setMessages((m) => [...m, bot]);
      router.refresh();
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        { role: "bot", text: `Error: ${String(err)}`, type: "faq" },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function markPaid(id?: string) {
    if (!id) return;
    await fetch(`/api/invoices/${id}/pay`, {
      method: "POST",
      cache: "no-store",
    });
    setMessages((m) => [
      ...m,
      { role: "bot", text: "Invoice marked as paid.", type: "payment" },
    ]);
    router.refresh();
  }

  function Quick({ fill }: { fill: string }) {
    return (
      <button
        onClick={() => setText(fill)}
        className="px-2 py-1 rounded-full text-xs bg-slate-100 hover:bg-slate-200"
        type="button"
        title="Fill input"
      >
        {fill}
      </button>
    );
  }

  const bubbleBase =
    "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow whitespace-pre-wrap";

  return (
    <div className="card">
      <div className="flex items-end justify-between mb-3">
        <h2 className="font-medium">Chat simulator</h2>
        <div className="flex items-center gap-2">
          <input
            className="input w-48"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="From (phone)"
          />
          <span className="text-xs text-slate-500">From</span>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="h-64 overflow-y-auto rounded border border-slate-200 p-3 space-y-2 bg-white"
      >
        {messages.length === 0 && (
          <p className="text-xs text-slate-500">
            Try: <code className="font-mono">What are your opening hours?</code>{" "}
            • <code className="font-mono">60m massage tomorrow after 3pm</code>{" "}
            • <code className="font-mono">Can I pay a deposit now?</code>
          </p>
        )}

        {messages.map((m, i) => {
          const isUser = m.role === "user";
          const isQuiet = m.role === "bot" && m.type === "quiet";
          const isPayment = m.role === "bot" && m.type === "payment";

          return (
            <div
              key={i}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={[
                  bubbleBase,
                  isUser
                    ? "bg-indigo-600 text-white"
                    : isQuiet
                    ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
                    : "bg-slate-100",
                ].join(" ")}
              >
                {/* Quiet-hours label */}
                {isQuiet && (
                  <div className="mb-1 text-xs font-medium flex items-center gap-1">
                    <span aria-hidden>⚠️</span> Quiet hours
                  </div>
                )}

                <div>{m.text}</div>

                {/* Payment quick actions */}
                {isPayment && (
                  <div className="mt-2 flex items-center gap-2">
                    {m.paylink && (
                      <a
                        className="btn btn-secondary btn-xs"
                        href={m.paylink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open paylink
                      </a>
                    )}
                    {m.invoiceId && (
                      <button
                        className="btn btn-primary btn-xs"
                        onClick={() => markPaid(m.invoiceId)}
                        type="button"
                      >
                        Mark paid
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="input flex-1"
          placeholder='Type a message… e.g. "Can I pay a deposit now?"'
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
        />
        <button className="btn btn-primary" onClick={send} disabled={sending}>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Quick fill="What are your opening hours?" />
        <Quick fill="I'd like a 60m massage tomorrow after 3pm" />
        <Quick fill="Can I pay a deposit now with my card?" />
      </div>
    </div>
  );
}
