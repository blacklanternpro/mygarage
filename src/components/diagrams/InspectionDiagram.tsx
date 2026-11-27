/**
 * Self-contained inspection visuals (no external images). Line drawings in sump ink; only the
 * fault zone takes status colour; measurements are called out as instrument readouts.
 */
import type { Severity } from "@/db/schema";

const INK = "#1F2428";
const MUTED = "#4D5660";
const CHALK = "#CFCAC0";
const COLOUR: Record<Severity, string> = { URGENT_RED: "#C42F1C", WATCH_AMBER: "#E08900", HEALTHY_GREEN: "#2C7A4B" };
const WASH: Record<Severity, string> = { URGENT_RED: "#F6E1DC", WATCH_AMBER: "#FAEDD5", HEALTHY_GREEN: "#DFEEE4" };

interface Props {
  kind: string | null;
  severity: Severity;
  measurement?: string | null;
  title: string;
  annotations?: { x: number; y: number; label: string }[] | null;
}

const mono = { fontFamily: "var(--font-mono), ui-monospace, monospace", fontSize: 11, fill: INK } as const;
const sans = { fontFamily: "var(--font-sans), system-ui, sans-serif", fontSize: 11, fill: MUTED } as const;

function firstNumber(s?: string | null): number | null {
  const m = s?.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function BrakePad({ severity, measurement }: Props) {
  const mm = Math.min(12, Math.max(0.5, firstNumber(measurement) ?? 6));
  const c = COLOUR[severity];
  const scaleTop = 26;
  const scaleH = 108;
  const y = (v: number) => scaleTop + scaleH - (v / 12) * scaleH;
  const friction = 4 + (mm / 12) * 30;
  return (
    <svg viewBox="0 0 320 160" role="img" aria-label={`Brake pad wear gauge: ${mm} millimetres of friction material left`}>
      {/* disc */}
      <rect x="112" y="20" width="16" height="120" rx="2" fill="#fff" stroke={INK} strokeWidth="2" />
      <text x="120" y="154" textAnchor="middle" {...sans}>Disc</text>
      {/* inner pad */}
      <rect x={112 - 8 - friction} y="42" width={friction} height="76" fill={WASH[severity]} stroke={c} strokeWidth="2" />
      <rect x={112 - 8 - friction - 8} y="38" width="8" height="84" fill={INK} />
      {/* outer pad */}
      <rect x={128 + 8} y="42" width={friction} height="76" fill={WASH[severity]} stroke={c} strokeWidth="2" />
      <rect x={128 + 8 + friction} y="38" width="8" height="84" fill={INK} />
      <path d={`M ${112 - 16 - friction} 38 L 40 24`} stroke={MUTED} strokeWidth="1" />
      <text x="8" y="20" {...sans}>Backing plate</text>
      <path d={`M ${136 + friction / 2} 122 L ${136 + friction / 2 + 34} 136`} stroke={c} strokeWidth="1.5" />
      <text x={136 + friction / 2 + 38} y="140" {...mono} fill={c} fontWeight={600}>
        {mm} mm left
      </text>
      {/* scale */}
      <line x1="262" y1={scaleTop} x2="262" y2={scaleTop + scaleH} stroke={INK} strokeWidth="2" />
      {[0, 3, 6, 9, 12].map((v) => (
        <g key={v}>
          <line x1="256" y1={y(v)} x2="268" y2={y(v)} stroke={INK} strokeWidth="1.5" />
          <text x="276" y={y(v) + 4} {...mono}>{v}</text>
        </g>
      ))}
      <rect x="258" y={y(3)} width="8" height={(3 / 12) * scaleH} fill={WASH.URGENT_RED} stroke="#C42F1C" strokeWidth="1" />
      <line x1="236" y1={y(3)} x2="256" y2={y(3)} stroke="#C42F1C" strokeWidth="1.5" strokeDasharray="3 3" />
      <text x="234" y={y(3) + 4} textAnchor="end" {...sans} fill="#C42F1C">Replace at 3</text>
      <path d={`M 244 ${y(mm)} L 256 ${y(mm)} M 250 ${y(mm) - 4} L 256 ${y(mm)} L 250 ${y(mm) + 4}`} stroke={c} strokeWidth="2" fill="none" />
      <text x="234" y={y(12) + 4} textAnchor="end" {...sans}>New 12</text>
      <text x="300" y={scaleTop - 8} textAnchor="end" {...sans}>mm</text>
    </svg>
  );
}

function Shock({ severity, measurement }: Props) {
  const c = COLOUR[severity];
  return (
    <svg viewBox="0 0 320 160" role="img" aria-label={`Shock absorber diagram: ${measurement ?? "oil misting at the seal"}`}>
      {/* top eye */}
      <circle cx="120" cy="18" r="9" fill="#fff" stroke={INK} strokeWidth="2" />
      {/* shaft */}
      <rect x="116" y="27" width="8" height="40" fill="#fff" stroke={INK} strokeWidth="2" />
      {/* seal */}
      <rect x="106" y="64" width="28" height="7" rx="1" fill={c} />
      {/* body */}
      <rect x="102" y="70" width="36" height="66" rx="3" fill="#fff" stroke={INK} strokeWidth="2" />
      <circle cx="120" cy="146" r="8" fill="#fff" stroke={INK} strokeWidth="2" />
      {/* mist */}
      {[
        [96, 80, 2.2],
        [92, 92, 1.8],
        [98, 104, 2.4],
        [144, 84, 2],
        [148, 98, 2.4],
        [142, 112, 1.6],
        [95, 118, 1.4],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={c} opacity={0.75} />
      ))}
      <path d="M 104 78 C 100 92 104 108 102 124" stroke={c} strokeWidth="2" fill="none" opacity={0.5} />
      <path d="M 134 68 L 190 48" stroke={INK} strokeWidth="1.5" />
      <text x="194" y="44" {...sans} fill={INK} fontWeight={600}>Shaft seal</text>
      <text x="194" y="58" {...sans}>Oil film forming</text>
      <path d="M 150 98 L 190 104" stroke={INK} strokeWidth="1.5" />
      <text x="194" y="102" {...mono} fill={c} fontWeight={600}>{measurement ?? "Misting"}</text>
      <text x="194" y="118" {...sans}>Damping still OK on</text>
      <text x="194" y="131" {...sans}>bounce test</text>
    </svg>
  );
}

function Battery({ severity, measurement }: Props) {
  const pct = Math.min(100, Math.max(0, firstNumber(measurement) ?? 80));
  const c = COLOUR[severity];
  const segs = 10;
  const lit = Math.round((pct / 100) * segs);
  return (
    <svg viewBox="0 0 320 160" role="img" aria-label={`Battery health test: ${pct} percent`}>
      <rect x="20" y="40" width="110" height="80" rx="4" fill="#fff" stroke={INK} strokeWidth="2" />
      <rect x="36" y="30" width="18" height="10" fill={INK} />
      <rect x="96" y="30" width="18" height="10" fill={INK} />
      <text x="45" y="62" textAnchor="middle" {...mono} fontSize={16} fontWeight={700}>−</text>
      <text x="105" y="62" textAnchor="middle" {...mono} fontSize={16} fontWeight={700}>+</text>
      <text x="75" y="98" textAnchor="middle" {...mono} fontSize={13} fontWeight={600}>12 V</text>
      {/* gauge */}
      <text x="152" y="40" {...sans} fill={INK} fontWeight={600}>Cranking health</text>
      {Array.from({ length: segs }).map((_, i) => (
        <rect key={i} x={152 + i * 15} y="50" width="12" height="28" rx="1.5" fill={i < lit ? c : "#fff"} stroke={i < lit ? c : CHALK} strokeWidth="1.5" />
      ))}
      <line x1={152 + 7 * 15 - 1.5} y1="44" x2={152 + 7 * 15 - 1.5} y2="86" stroke={INK} strokeWidth="1.5" strokeDasharray="3 3" />
      <text x={152 + 7 * 15 - 1.5} y="100" textAnchor="middle" {...sans}>Winter-safe 70%</text>
      <text x="152" y="128" {...mono} fill={c} fontSize={13} fontWeight={700}>{measurement ?? `${pct}%`}</text>
    </svg>
  );
}

function Tyre({ severity, measurement }: Props) {
  const mm = Math.min(9, Math.max(0.5, firstNumber(measurement) ?? 5));
  const c = COLOUR[severity];
  const base = 118;
  const depth = (mm / 9) * 52;
  return (
    <svg viewBox="0 0 320 160" role="img" aria-label={`Tyre tread depth gauge: ${mm} millimetres`}>
      <rect x="20" y={base} width="200" height="22" fill="#fff" stroke={INK} strokeWidth="2" />
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={i} x={26 + i * 33} y={base - depth} width="24" height={depth} fill={WASH[severity]} stroke={c} strokeWidth="2" />
      ))}
      <line x1="20" y1={base - (1.5 / 9) * 52} x2="220" y2={base - (1.5 / 9) * 52} stroke="#C42F1C" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x="228" y={base - (1.5 / 9) * 52 + 4} {...sans} fill="#C42F1C">Legal 1.5 mm</text>
      <line x1="20" y1={base - (8 / 9) * 52} x2="220" y2={base - (8 / 9) * 52} stroke={CHALK} strokeWidth="1.5" strokeDasharray="4 3" />
      <text x="228" y={base - (8 / 9) * 52 + 4} {...sans}>New ~8 mm</text>
      <text x="228" y={base - depth + 22} {...mono} fill={c} fontWeight={700} fontSize={13}>{mm} mm</text>
      <text x="20" y="152" {...sans}>Tread cross-section</text>
    </svg>
  );
}

function Belt({ severity, measurement }: Props) {
  const c = COLOUR[severity];
  const done = firstNumber(measurement?.replace(/,/g, "")) ?? 0;
  const pct = Math.min(1, done / 150000);
  return (
    <svg viewBox="0 0 320 160" role="img" aria-label="Accessory drive belt routing and major service progress">
      <circle cx="60" cy="110" r="26" fill="#fff" stroke={INK} strokeWidth="2" />
      <circle cx="60" cy="38" r="16" fill="#fff" stroke={INK} strokeWidth="2" />
      <circle cx="128" cy="56" r="18" fill="#fff" stroke={INK} strokeWidth="2" />
      <circle cx="104" cy="104" r="9" fill="#fff" stroke={INK} strokeWidth="2" />
      <path d="M 34 110 L 44 38 M 76 38 C 96 30 112 36 112 50 M 146 58 L 128 128 M 128 128 C 96 140 66 140 60 136" stroke={c} strokeWidth="5" fill="none" strokeLinecap="round" />
      <text x="60" y="114" textAnchor="middle" {...sans}>Crank</text>
      <text x="60" y="42" textAnchor="middle" {...sans}>Alt</text>
      <text x="128" y="60" textAnchor="middle" {...sans}>Pump</text>
      <text x="176" y="28" {...sans} fill={INK} fontWeight={600}>150,000 km major service</text>
      <rect x="176" y="40" width="124" height="12" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <rect x="177.5" y="41.5" width={121 * pct} height="9" fill={c} />
      <text x="176" y="68" {...mono} fill={c} fontWeight={600}>{measurement ?? ""}</text>
      <text x="176" y="96" {...sans}>Drive belt: light cracking</text>
      <text x="176" y="110" {...sans}>Cam drive: timing chain</text>
      <text x="176" y="124" {...sans}>(no belt to replace)</text>
    </svg>
  );
}

function Generic({ severity, measurement, title }: Props) {
  const c = COLOUR[severity];
  return (
    <svg viewBox="0 0 320 160" role="img" aria-label={`${title}${measurement ? `: ${measurement}` : ""}`}>
      <path d="M 70 30 C 70 30 40 70 40 92 a 30 30 0 0 0 60 0 C 100 70 70 30 70 30 z" fill={WASH[severity]} stroke={c} strokeWidth="2" />
      <text x="128" y="70" {...sans} fill={INK} fontWeight={600}>{title.length > 30 ? `${title.slice(0, 30)}…` : title}</text>
      {measurement ? <text x="128" y="92" {...mono} fill={c} fontWeight={600}>{measurement}</text> : null}
    </svg>
  );
}

export function InspectionDiagram(props: Props) {
  const body =
    props.kind === "BRAKE_PAD" ? <BrakePad {...props} /> : props.kind === "SHOCK" ? <Shock {...props} /> : props.kind === "BATTERY" ? <Battery {...props} /> : props.kind === "TYRE" ? <Tyre {...props} /> : props.kind === "BELT" ? <Belt {...props} /> : <Generic {...props} />;
  return (
    <figure className="relative max-w-[440px] overflow-hidden rounded-md border border-chalk bg-white">
      <div className="px-2 pt-2 [&>svg]:h-auto [&>svg]:w-full">{body}</div>
      {props.annotations?.map((a, i) => (
        <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}>
          <span className="block h-7 w-7 rounded-full border-[3px]" style={{ borderColor: COLOUR[props.severity] }} />
          <span className="readout absolute left-8 top-0 whitespace-nowrap rounded bg-sump px-1.5 py-0.5 text-[11px] text-white">{a.label}</span>
        </span>
      ))}
      <figcaption className="border-t border-chalk px-3 py-1.5 text-[12px] text-slate">Annotated inspection visual: {props.title}</figcaption>
    </figure>
  );
}
