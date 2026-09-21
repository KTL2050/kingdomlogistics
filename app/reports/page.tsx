import { AppShell } from "@/components/layout/AppShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ReportsCharts } from "@/components/reports/ReportsCharts";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { getKpiSummary, getShipments } from "@/lib/data";
import { Boxes, Clock, Percent, Timer } from "lucide-react";

export default async function ReportsPage() {
  const [shipments, kpi] = await Promise.all([getShipments(), getKpiSummary()]);

  const delayed = shipments.filter((s) => s.health === "delayed");
  const avgDelay =
    delayed.reduce((sum, s) => sum + s.delayDays, 0) / Math.max(1, delayed.length);

  const transitDays = shipments.map(
    (s) => (new Date(s.finalEta).getTime() - new Date(s.etd).getTime()) / 86_400_000
  );
  const avgTransit = transitDays.reduce((a, b) => a + b, 0) / Math.max(1, transitDays.length);

  return (
    <AppShell
      breadcrumb="Logistics / Reports"
      title="Reports"
      subtitle="Performance analytics across your shipment network"
    >
      <ExportButtons shipments={shipments} kpi={kpi} avgDelay={avgDelay} avgTransit={avgTransit} />

      <div id="reports-export-area" className="bg-page">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={Boxes} label="Total Shipments" value={kpi.total} supporting="All time" tone="accent" />
          <KpiCard
            icon={Percent}
            label="On-Time Rate"
            value={Math.round((kpi.onTime / kpi.total) * 100)}
            supporting="Percent of shipments"
            tone="success"
          />
          <KpiCard
            icon={Clock}
            label="Avg. Delay"
            value={Number(avgDelay.toFixed(1))}
            supporting="Days, delayed shipments only"
            tone="danger"
          />
          <KpiCard
            icon={Timer}
            label="Avg. Transit Time"
            value={Math.round(avgTransit)}
            supporting="Days, ETD to final ETA"
            tone="warning"
          />
        </div>

        <div className="mt-4">
          <ReportsCharts shipments={shipments} />
        </div>
      </div>
    </AppShell>
  );
}