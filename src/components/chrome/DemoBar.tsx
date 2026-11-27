"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { MagicLinkModal } from "./MagicLinkModal";
import { AdapterInspector } from "./AdapterInspector";

const SURFACES: { href: string; label: string; short: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/", label: "Customer phone", short: "Customer", icon: "car", match: (p) => p === "/" || p.startsWith("/sale-pack") || p.startsWith("/wallet") },
  { href: "/counter", label: "Front counter", short: "Counter", icon: "counter", match: (p) => p.startsWith("/counter") },
  { href: "/bay", label: "Bay tablet", short: "Bay", icon: "bay", match: (p) => p.startsWith("/bay") },
];

/** Discreet, collapsible demo chrome: surface switcher, adapter inspector, magic-link preview, reset. */
export function DemoBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [inspector, setInspector] = useState(false);
  const [magic, setMagic] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("mg-demobar") === "collapsed");
    } catch {
      /* storage unavailable */
    }
  }, []);
  const setCollapsedPersist = (v: boolean) => {
    setCollapsed(v);
    try {
      localStorage.setItem("mg-demobar", v ? "collapsed" : "open");
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const reset = async () => {
    setResetting(true);
    const res = await fetch("/api/demo/reset", { method: "POST" }).catch(() => null);
    setResetting(false);
    if (res?.ok) {
      setToast("Demo reset. Fresh seed loaded.");
      router.refresh();
    } else setToast("Reset failed. Is the dev server running?");
  };

  if (pathname.startsWith("/sale-pack")) return null;

  if (collapsed)
    return (
      <button
        type="button"
        onClick={() => setCollapsedPersist(false)}
        className="no-print fixed right-2 top-2 z-40 inline-flex h-9 items-center gap-1.5 rounded-full bg-sump/85 px-3 text-[12px] font-semibold text-white shadow-sheet backdrop-blur"
        aria-label="Show demo switcher and adapter inspector"
      >
        <Icon name="eye" size={14} /> Demo
      </button>
    );

  return (
    <div className="no-print sticky top-0 z-40 bg-sump text-white">
      <div className="mx-auto flex h-11 max-w-[1440px] items-center gap-1 px-2 sm:px-3">
        <span className="hidden pr-2 text-[12px] font-semibold text-white/60 md:inline">Stage 1 demo</span>
        <nav aria-label="Demo surfaces" className="flex min-w-0 items-center gap-0.5">
          {SURFACES.map((s) => {
            const active = s.match(pathname);
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-9 items-center gap-1.5 rounded px-2 text-[13px] font-semibold ${active ? "bg-white text-sump" : "text-white/85 hover:bg-white/10"}`}
              >
                <Icon name={s.icon} size={16} />
                <span className="sm:hidden">{s.short}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={() => setMagic(true)} className="hidden h-9 items-center gap-1.5 rounded px-2 text-[13px] font-semibold text-white/85 hover:bg-white/10 md:inline-flex">
            <Icon name="link" size={16} /> SMS magic link
          </button>
          <button
            type="button"
            onClick={() => setInspector((v) => !v)}
            aria-expanded={inspector}
            className={`inline-flex h-9 items-center gap-1.5 rounded px-2 text-[13px] font-semibold ${inspector ? "bg-white/15" : "text-white/85 hover:bg-white/10"}`}
          >
            <Icon name="signal" size={16} />
            <span className="hidden sm:inline">Adapters</span>
            <span className="readout rounded-sm bg-rag-amber px-1 text-[10px] font-bold text-sump">MOCK</span>
          </button>
          <button type="button" onClick={reset} disabled={resetting} className="inline-flex h-9 items-center gap-1.5 rounded px-2 text-[13px] font-semibold text-white/85 hover:bg-white/10" aria-label="Reset demo data">
            <Icon name="refresh" size={16} className={resetting ? "animate-spin" : ""} />
            <span className="hidden lg:inline">Reset demo</span>
          </button>
          <button type="button" onClick={() => setCollapsedPersist(true)} className="inline-flex h-9 w-9 items-center justify-center rounded text-white/70 hover:bg-white/10" aria-label="Hide demo bar">
            <Icon name="chevronDown" size={16} className="rotate-180" />
          </button>
        </div>
      </div>
      {inspector ? <AdapterInspector onMagicLink={() => setMagic(true)} onClose={() => setInspector(false)} /> : null}
      <MagicLinkModal open={magic} onClose={() => setMagic(false)} />
      {toast ? (
        <div role="status" className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-md bg-sump px-4 py-2.5 text-[14px] font-semibold text-white shadow-sheet">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
