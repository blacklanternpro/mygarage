"use client";
import { Icon } from "@/components/ui/Icon";

export function PrintButton() {
  return (
    <button type="button" className="btn btn-primary" onClick={() => window.print()}>
      <Icon name="download" size={18} /> Print or save as PDF
    </button>
  );
}
