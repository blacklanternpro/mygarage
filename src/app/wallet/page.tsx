import { Suspense } from "react";
import type { Metadata } from "next";
import { WalletScreen } from "@/components/wallet/WalletScreen";

export const metadata: Metadata = { title: "Digital service sticker" };

export default function WalletPage({ searchParams }: PageProps<"/wallet">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-[452px] max-w-[340px] rounded-[14px] bg-brand/80" aria-busy="true" />}>
      <WalletScreen searchParams={searchParams} />
    </Suspense>
  );
}
