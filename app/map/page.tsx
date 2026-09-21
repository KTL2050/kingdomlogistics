import { AppShell } from "@/components/layout/AppShell";
import { TrackingMap } from "@/components/dashboard/TrackingMap";
import { ShipmentStatusPanel } from "@/components/dashboard/ShipmentStatusPanel";
import { getShipments } from "@/lib/data";

export default async function MapPage() {
  const shipments = await getShipments();

  return (
    <AppShell
      breadcrumb="Logistics / Map"
      title="Live Map"
      subtitle="Every container's current position, in one view"
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="h-[calc(100vh-220px)] min-h-[420px] overflow-hidden rounded-xl border border-border bg-surface">
          <TrackingMap shipments={shipments} />
        </div>
        <div className="h-[calc(100vh-220px)] min-h-[420px]">
          <ShipmentStatusPanel shipments={shipments} />
        </div>
      </div>
    </AppShell>
  );
}
