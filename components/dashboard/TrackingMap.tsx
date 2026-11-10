"use client";

import dynamic from "next/dynamic";
import type { Country, Shipment } from "@/types";

const TrackingMapInner = dynamic(
  () => import("@/components/dashboard/TrackingMapInner"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-page text-sm text-text-tertiary">
        Loading map…
      </div>
    ),
  }
);

export function TrackingMap({ shipments, country }: { shipments: Shipment[]; country: Country }) {
  return <TrackingMapInner key={country} shipments={shipments} country={country} />;
}
