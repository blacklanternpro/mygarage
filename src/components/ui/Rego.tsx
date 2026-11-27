/** Rego plate: the customer's own identifier, rendered like the plate on the car. */
export function Rego({ rego, state, size = "md" }: { rego: string; state: string; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "text-xl px-3 py-1.5" : size === "sm" ? "text-[12px] px-1.5 py-0.5" : "text-[15px] px-2 py-1";
  return (
    <span className={`plate ${cls}`} aria-label={`Registration ${rego}, ${state}`}>
      <span>{rego}</span>
      <span className="font-sans text-[0.6em] font-semibold tracking-normal text-slate" aria-hidden="true">
        {state}
      </span>
    </span>
  );
}
