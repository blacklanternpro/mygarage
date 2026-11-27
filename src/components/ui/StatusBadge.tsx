import type { Severity } from "@/db/schema";

const META: Record<Severity, { label: string; cls: string; shape: "square" | "gauge" | "tick" }> = {
  URGENT_RED: { label: "Urgent", cls: "bg-rag-red text-white", shape: "square" },
  WATCH_AMBER: { label: "Watch", cls: "bg-rag-amber text-sump", shape: "gauge" },
  HEALTHY_GREEN: { label: "Healthy", cls: "bg-rag-green text-white", shape: "tick" },
};

function Shape({ shape }: { shape: "square" | "gauge" | "tick" }) {
  if (shape === "square")
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <rect x="0.5" y="0.5" width="11" height="11" rx="1" fill="none" stroke="currentColor" />
        <path d="M6 3v3.6M6 8.6v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  if (shape === "gauge")
    return (
      <svg width="13" height="12" viewBox="0 0 13 12" aria-hidden="true">
        <path d="M1.5 10a5 5 0 1 1 10 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M6.5 10l2.4-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2 6.4l2.6 2.6L10 3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StatusBadge({ severity, size = "md", label }: { severity: Severity; size?: "md" | "lg"; label?: string }) {
  const m = META[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[3px] font-semibold leading-none ${m.cls} ${size === "lg" ? "px-2.5 py-1.5 text-[14px]" : "px-1.5 py-1 text-[12px]"}`}>
      <Shape shape={m.shape} />
      {label ?? m.label}
    </span>
  );
}

export function HealthDot({ severity }: { severity: Severity }) {
  const c = severity === "URGENT_RED" ? "bg-rag-red" : severity === "WATCH_AMBER" ? "bg-rag-amber" : "bg-rag-green";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${c}`} aria-hidden="true" />;
}

export const TAG_COLOUR: Record<Severity, string> = {
  URGENT_RED: "var(--color-rag-red)",
  WATCH_AMBER: "var(--color-rag-amber)",
  HEALTHY_GREEN: "var(--color-rag-green)",
};
