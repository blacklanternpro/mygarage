"use client";
import { useRef, useState } from "react";

const W = 600;
const H = 180;

/** Finger/stylus signature captured as an SVG path (sanitised server-side, hashed in the vault). */
export function SignaturePad({ onChange, label = "Sign here" }: { onChange: (svg: string | null) => void; label?: string }) {
  const [paths, setPaths] = useState<string[]>([]);
  const pathsRef = useRef<string[]>([]);
  const drawing = useRef(false);
  const box = useRef<SVGSVGElement>(null);

  const commit = (next: string[]) => {
    pathsRef.current = next;
    setPaths(next);
  };
  const emit = () => {
    const d = pathsRef.current.join(" ");
    const points = (d.match(/[ML]/g) ?? []).length;
    onChange(points >= 6 ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><path d="${d}" fill="none" stroke="#1F2428" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>` : null);
  };
  const point = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return `${Math.round(((e.clientX - r.left) / r.width) * W)} ${Math.round(((e.clientY - r.top) / r.height) * H)}`;
  };
  const finish = () => {
    if (!drawing.current) return;
    drawing.current = false;
    emit();
  };

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="label mb-0">{label}</span>
        <button
          type="button"
          className="btn btn-quiet min-h-10 text-[14px]"
          onClick={() => {
            commit([]);
            onChange(null);
          }}
        >
          Clear
        </button>
      </div>
      <svg
        ref={box}
        viewBox={`0 0 ${W} ${H}`}
        className="h-[132px] w-full touch-none rounded-md border-[1.5px] border-chalk bg-white"
        role="img"
        aria-label="Signature area. Draw your signature with your finger or a mouse."
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drawing.current = true;
          commit([...pathsRef.current, `M ${point(e)}`]);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ps = pathsRef.current;
          commit([...ps.slice(0, -1), `${ps[ps.length - 1]} L ${point(e)}`]);
        }}
        onPointerUp={finish}
        onPointerLeave={finish}
        onPointerCancel={finish}
      >
        <line x1="24" y1={H - 40} x2={W - 24} y2={H - 40} stroke="#CFCAC0" strokeWidth="1.5" strokeDasharray="6 6" />
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#1F2428" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
    </div>
  );
}
