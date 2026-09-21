import { AppShell } from "@/components/layout/AppShell";
import { ShipmentsTable } from "@/components/shipments/ShipmentsTable";
import { getShipments } from "@/lib/data";

export default async function ShipmentsPage() {
  const shipments = await getShipments();

  return (
    <AppShell
      breadcrumb="Logistics / Shipments"
      title="Shipments"
      subtitle="Search, filter, and manage every active shipment"
    >
      <ShipmentsTable shipments={shipments} />
    </AppShell>
  );
}
