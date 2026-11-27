import { Suspense } from "react";
import type { Metadata } from "next";
import { CounterScreen } from "@/components/counter/CounterScreen";

export const metadata: Metadata = { title: "Front counter" };

export default function CounterPage({ searchParams }: PageProps<"/counter">) {
  return (
    <Suspense fallback={<div className="p-6 text-slate" aria-busy="true">Loading the counter…</div>}>
      <CounterScreen searchParams={searchParams} />
    </Suspense>
  );
}
