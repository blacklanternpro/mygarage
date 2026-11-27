"use client";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/** POST JSON to an API route, surface domain errors, then refresh server components. */
export function useAction<T = unknown>() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [, startTransition] = useTransition();

  const call = useCallback(
    async (url: string, body?: unknown, opts: { refresh?: boolean; form?: FormData } = {}): Promise<T | null> => {
      setPending(true);
      setError(null);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: opts.form ? undefined : { "content-type": "application/json" },
          body: opts.form ?? JSON.stringify(body ?? {}),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.error ?? { code: "HTTP_" + res.status, message: "That didn't work. Try again." });
          return null;
        }
        if (opts.refresh !== false) startTransition(() => router.refresh());
        return json as T;
      } catch {
        setError({ code: "NETWORK", message: "Couldn't reach the server. Check the dev server is running." });
        return null;
      } finally {
        setPending(false);
      }
    },
    [router],
  );
  return { call, pending, error, setError };
}

