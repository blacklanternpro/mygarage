import { Icon } from "./Icon";

/** Mandatory state repairer licence display (WA MRB / NSW MVRL). */
export function LicenceTag({ label, tone = "dark" }: { label: string; tone?: "dark" | "light" | "plain" }) {
  const cls =
    tone === "light"
      ? "border-white/40 text-white"
      : tone === "plain"
        ? "border-chalk text-slate"
        : "border-sump/30 text-sump";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[3px] border px-1.5 py-0.5 text-[12px] font-semibold leading-tight ${cls}`}>
      <Icon name="shield" size={13} />
      <span className="readout text-[11.5px]">{label}</span>
    </span>
  );
}
