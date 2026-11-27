"use client";
import { useState } from "react";
import type { Message } from "@/db/schema";
import { formatDateTime } from "@/domain/format";
import { useAction } from "@/components/ui/useAction";
import { ErrorBanner } from "@/components/ui/Notice";
import { Icon } from "@/components/ui/Icon";

export function Bubble({ m }: { m: Message }) {
  const mine = m.authorRole === "CUSTOMER";
  const system = m.authorRole === "SYSTEM";
  if (system)
    return (
      <li className="flex justify-center">
        <p className="max-w-[90%] rounded bg-stone px-2.5 py-1.5 text-center text-[12.5px] leading-snug text-slate">
          {m.body} <span className="readout whitespace-nowrap text-[11px]">{formatDateTime(m.createdAt)}</span>
        </p>
      </li>
    );
  return (
    <li className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? "rounded-br-sm bg-sump text-white" : "rounded-bl-sm border border-chalk bg-white"}`}>
        <p className={`text-[12px] font-semibold ${mine ? "text-white/70" : "text-slate"}`}>
          {m.authorName}
          {m.channel === "SMS" ? " · SMS" : ""}
        </p>
        <p className="whitespace-pre-line text-[14.5px] leading-snug">{m.body}</p>
        <p className={`readout mt-1 text-[10.5px] ${mine ? "text-white/60" : "text-slate"}`}>{formatDateTime(m.createdAt)}</p>
      </div>
    </li>
  );
}

export function Composer({ onSend, pending, placeholder }: { onSend: (body: string) => Promise<boolean>; pending: boolean; placeholder: string }) {
  const [body, setBody] = useState("");
  return (
    <form
      className="mt-3 flex items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return;
        if (await onSend(body.trim())) setBody("");
      }}
    >
      <label className="sr-only" htmlFor={`composer-${placeholder}`}>
        Message
      </label>
      <textarea id={`composer-${placeholder}`} className="field min-h-11 flex-1 resize-none" rows={1} value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} />
      <button type="submit" className="btn btn-primary h-11 w-11 px-0" disabled={pending || !body.trim()} aria-label="Send message">
        <Icon name="arrowUp" />
      </button>
    </form>
  );
}

export function MessageThread({ vehicleId, messages, authorName, workshopName }: { vehicleId: string; messages: Message[]; authorName: string; workshopName: string }) {
  const { call, pending, error } = useAction();
  return (
    <section id="messages" aria-labelledby="msg-h" className="mt-8 scroll-mt-14">
      <h2 id="msg-h" className="rule-heavy pt-2 text-[19px] font-bold">
        Messages about this vehicle
      </h2>
      <p className="mt-1 text-[13px] text-slate">Goes straight to {workshopName}, attached to this vehicle. No more “which white ute?”</p>
      <ul className="mt-3 space-y-2">
        {messages.length ? messages.map((m) => <Bubble key={m.id} m={m} />) : <li className="text-[14px] text-slate">No messages yet.</li>}
      </ul>
      <ErrorBanner error={error} />
      <Composer pending={pending} placeholder="Message the workshop" onSend={async (body) => !!(await call("/api/messages", { vehicleId, thread: "VEHICLE", authorRole: "CUSTOMER", authorName: authorName || "Customer", body }))} />
    </section>
  );
}
