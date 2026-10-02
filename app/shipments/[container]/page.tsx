import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MilestoneTimeline } from "@/components/dashboard/MilestoneTimeline";
import { TrackingForm } from "@/components/shipments/TrackingForm";
import { ManualProgressForm } from "@/components/shipments/ManualProgressForm";
import { ContainerStageDurationsPanel } from "@/components/shipments/ContainerStageDurationsPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CompanyBadge } from "@/components/ui/CompanyBadge";
import { getShipmentByContainer, getCurrentUser } from "@/lib/data";
import { getRouteStepsForContainer } from "@/lib/mock-data";
import { canManageStageDurations, canSendInlandUpdates } from "@/lib/utils";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ container: string }>;
}) {
  const { container } = await params;
  const [shipment, user] = await Promise.all([getShipmentByContainer(container), getCurrentUser()]);

  if (!shipment) notFound();
  if (!user) redirect("/login");

  // Sending inland progress updates is restricted to Logistics Manager
  // specifically — narrower than who may set stage-duration overrides
  // on this container, which stays open to Admin/Operations Officer too.
  const canSendUpdate = user.status === "approved" && canSendInlandUpdates(user.role);
  const canManageContainer = user.status === "approved" && canManageStageDurations(user.role);

  return (
    <AppShell
      breadcrumb="Logistics / Shipments"
      title={`Shipment ${shipment.containerNumber}`}
      subtitle={`${shipment.shipmentNumber} · ${shipment.customer}`}
    >
      <Link
        href="/shipments"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to shipments
      </Link>

      <div className="mb-4 grid grid-cols-2 gap-4 rounded-xl border border-border bg-surface p-5 sm:grid-cols-4">
        <div>
          <div className="text-xs text-text-tertiary">Company</div>
          <CompanyBadge containerNumber={shipment.containerNumber} />
        </div>
        <div>
          <div className="text-xs text-text-tertiary">Route</div>
          <div className="text-sm font-medium text-text-primary">
            {shipment.routeVia.join(" → ")}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-tertiary">Shipping Line</div>
          <div className="text-sm font-medium text-text-primary">{shipment.shippingLine}</div>
        </div>
        <div>
          <div className="text-xs text-text-tertiary">Status</div>
          <StatusBadge health={shipment.health} delayDays={shipment.delayDays} />
        </div>
      </div>

      <div className="mb-4">
        <TrackingForm
          shipmentId={shipment.id}
          containerNumber={shipment.containerNumber}
          currentReference={shipment.trackingReference}
          currentReferenceType={shipment.trackingReferenceType}
          lastSyncedAt={shipment.trackingLastSyncedAt}
        />
      </div>

      {canSendUpdate && (
        <div className="mb-4">
          <ManualProgressForm
            shipmentId={shipment.id}
            containerNumber={shipment.containerNumber}
            steps={getRouteStepsForContainer(shipment.containerNumber)}
            milestones={shipment.milestones}
            currentUserName={user.fullName}
          />
        </div>
      )}

      {canManageContainer && (
        <div className="mb-4">
          <ContainerStageDurationsPanel
            shipmentId={shipment.id}
            containerNumber={shipment.containerNumber}
            steps={getRouteStepsForContainer(shipment.containerNumber)}
            etd={shipment.etd}
            milestones={shipment.milestones}
          />
        </div>
      )}

      <MilestoneTimeline shipment={shipment} />
    </AppShell>
  );
}