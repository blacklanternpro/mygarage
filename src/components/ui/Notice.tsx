import type { ApiError } from "./useAction";
import { Icon } from "./Icon";

export function ErrorBanner({ error }: { error: ApiError | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-rag-red bg-rag-red-wash px-3 py-2 text-[14px] text-sump">
      <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-rag-red" />
      <span>{error.message}</span>
    </div>
  );
}

export function SuccessBanner({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-2 rounded-md border border-rag-green bg-rag-green-wash px-3 py-2 text-[14px] text-sump">
      <Icon name="check" size={18} className="mt-0.5 shrink-0 text-rag-green" />
      <div>{children}</div>
    </div>
  );
}
