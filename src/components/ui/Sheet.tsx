"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Bottom sheet on phones, right-hand panel from 768px. Esc and backdrop close it; focus moves
 * into the sheet on open and returns to the opener on close.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide = false,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>("[data-autofocus], button, input, select, textarea")?.focus(), 30);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  const id = labelledBy ?? `sheet-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end" role="presentation">
      <button type="button" aria-label="Close" tabIndex={-1} className="absolute inset-0 bg-sump/45" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={`sheet-enter relative flex max-h-[92dvh] w-full flex-col rounded-t-xl bg-bench shadow-sheet md:max-h-none md:rounded-none md:rounded-l-xl ${wide ? "md:w-[680px]" : "md:w-[480px]"}`}
      >
        <div className="flex items-start gap-3 border-b border-chalk px-4 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <h2 id={id} className="text-[19px] font-bold leading-tight">
              {title}
            </h2>
            {subtitle ? <div className="mt-1 text-[14px] text-slate">{subtitle}</div> : null}
          </div>
          <button type="button" onClick={onClose} className="-mr-1 -mt-1 inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-stone" aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="border-t border-chalk bg-bench px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div> : null}
      </div>
    </div>
  );
}
