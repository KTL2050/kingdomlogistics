import { Boxes, CheckCircle2, Clock, Hourglass } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ShipmentStatusPanel } from "@/components/dashboard/ShipmentStatusPanel";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { TrackingMap } from "@/components/dashboard/TrackingMap";
import { ContainerMilestoneSection } from "@/components/dashboard/ContainerMilestoneSection";
import { getAlerts, getCurrentUser, getKpiSummary, getShipments } from "@/lib/data";
import { canManageStageDurations } from "@/lib/utils";

export default async function ContainersPage() {
  const [shipments, alerts, kpi, user] = await Promise.all([
    getShipments(),
    getAlerts(),
    getKpiSummary(),
    getCurrentUser(),
  ]);
  const canAddNote = Boolean(user && canManageStageDurations(user.role));

  return (
    <AppShell
      breadcrumb="Logistics / Container Tracking"
      title="Shipment Control Tower"
      subtitle="Real-time visibility of container shipments"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Boxes}
          label="Total Containers"
          value={kpi.total}
          supporting="All shipments"
          tone="accent"
        />
        <KpiCard
          icon={CheckCircle2}
          label="On Time"
          value={kpi.onTime}
          supporting={`${((kpi.onTime / kpi.total) * 100).toFixed(1)}% of total`}
          tone="success"
        />
        <KpiCard
          icon={Clock}
          label="Delayed"
          value={kpi.delayed}
          supporting={`${((kpi.delayed / kpi.total) * 100).toFixed(1)}% of total`}
          tone="danger"
        />
        <KpiCard
          icon={Hourglass}
          label="Not Started"
          value={kpi.notStarted}
          supporting={`${((kpi.notStarted / kpi.total) * 100).toFixed(1)}% of total`}
          tone="warning"
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[65%_1fr]">
        <div className="h-[360px] overflow-hidden rounded-xl border border-border bg-surface">
          <TrackingMap shipments={shipments} />
        </div>
        <div className="h-[360px]">
          <ShipmentStatusPanel shipments={shipments} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_300px]">
        <ContainerMilestoneSection shipments={shipments} />
        <AlertsPanel alerts={alerts} canAddNote={canAddNote} currentUserName={user?.fullName} />
      </div>
    </AppShell>
  );
}
