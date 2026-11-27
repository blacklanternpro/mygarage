import { Suspense } from "react";
import { GarageScreen } from "@/components/garage/GarageScreen";
import { GarageSkeleton } from "@/components/garage/GarageSkeleton";

/** Customer "Living Garage" — lands straight in the seeded household (no login wall in Stage 1). */
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<GarageSkeleton />}>
      <GarageScreen searchParams={searchParams} />
    </Suspense>
  );
}
