import { Suspense } from "react";
import type { Metadata } from "next";
import { SalePack } from "@/components/salepack/SalePack";

export const metadata: Metadata = { title: "Verified Sale Pack" };

export default function SalePackPage({ params }: PageProps<"/sale-pack/[vehicleId]">) {
  return (
    <Suspense fallback={<p className="p-6" aria-busy="true">Preparing your Sale Pack…</p>}>
      <SalePack params={params} />
    </Suspense>
  );
}
