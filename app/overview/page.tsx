import { Boxes, CheckCircle2, Clock, Hourglass } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { getAlerts, getCurrentUser, getKpiSummary, getShipments } from "@/lib/data";
import { canManageStageDurations } from "@/lib/utils";
import Link from "next/link";

export default async function OverviewPage() {
  const [shipments, alerts, kpi, user] = await Promise.all([
    getShipments(),
    getAlerts(),
    getKpiSummary(),
    getCurrentUser(),
  ]);
  const canAddNote = Boolean(user && canManageStageDurations(user.role));

  const attention = [...shipments]
    .filter((s) => s.health === "delayed")
    .sort((a, b) => b.delayDays - a.delayDays)
    .slice(0, 5);

  const avgDelay =
    shipments.filter((s) => s.health === "delayed").reduce((sum, s) => sum + s.delayDays, 0) /
    Math.max(1, shipments.filter((s) => s.health === "delayed").length);

  return (
    <AppShell
      breadcrumb="Logistics / Overview"
      title="Overview"
      subtitle="A snapshot of shipment performance across your network"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Boxes} label="Total Containers" value={kpi.total} supporting="All shipments" tone="accent" />
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
          supporting={`Avg. ${avgDelay.toFixed(1)} days late`}
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

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        <div className="rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-[15px] font-semibold text-text-primary">
              Needs attention
            </h2>
            <Link href="/shipments" className="text-[13px] font-medium text-accent hover:underline">
              View all
            </Link>
          </div>
          {attention.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-text-tertiary">
              Nothing delayed right now.
            </div>
          ) : (
            attention.map((s) => (
              <Link
                key={s.id}
                href={`/shipments/${s.containerNumber}`}
                className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5 last:border-b-0 hover:bg-page"
              >
                <div>
                  <div className="text-sm font-medium text-text-primary">
                    {s.containerNumber} · {s.customer}
                  </div>
                  <div className="text-xs text-text-tertiary">
                    {s.currentStatus} — {s.currentLocation}
                  </div>
                </div>
                <StatusBadge health={s.health} delayDays={s.delayDays} />
              </Link>
            ))
          )}
        </div>

        <AlertsPanel alerts={alerts} canAddNote={canAddNote} currentUserName={user?.fullName} />
      </div>
    </AppShell>
  );
}
