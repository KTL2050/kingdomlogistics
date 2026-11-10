import { AppShell } from "@/components/layout/AppShell";
import { ShipmentsTable } from "@/components/shipments/ShipmentsTable";
import { getActiveCountry, getShipments } from "@/lib/data";

export default async function ShipmentsPage() {
  const [shipments, { country }] = await Promise.all([getShipments(), getActiveCountry()]);

  return (
    <AppShell
      breadcrumb="Logistics / Shipments"
      title="Shipments"
      subtitle="Search, filter, and manage every active shipment"
    >
      <ShipmentsTable key={country} shipments={shipments} country={country} />
    </AppShell>
  );
}
