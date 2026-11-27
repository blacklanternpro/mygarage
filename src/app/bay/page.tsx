import { Suspense } from "react";
import type { Metadata } from "next";
import { BayScreen } from "@/components/bay/BayScreen";

export const metadata: Metadata = { title: "Bay tablet" };

export default function BayPage({ searchParams }: PageProps<"/bay">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white p-6 text-black" aria-busy="true">Loading the bay…</div>}>
      <BayScreen searchParams={searchParams} />
    </Suspense>
  );
}
