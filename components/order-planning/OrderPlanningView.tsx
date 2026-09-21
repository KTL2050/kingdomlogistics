"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, Plus, Upload } from "lucide-react";
import { FilterTabs } from "@/components/ui/FilterButton";
import { AddPlannedOrderModal } from "@/components/order-planning/AddPlannedOrderModal";
import { ImportPlannedOrdersModal } from "@/components/order-planning/ImportPlannedOrdersModal";
import { DueSoonBanner } from "@/components/order-planning/DueSoonBanner";
import {
  describeOccurrenceStatus,
  getDueSoonOrders,
  getOrderOccurrences,
  getTimeframeRange,
  ORDER_FREQUENCY_LABELS,
  type OccurrenceStatus,
  type OrderPlanningTimeframe,
} from "@/lib/order-planning";
import type { PlannedOrder, Shipment } from "@/types";

const TIMEFRAMES: { value: OrderPlanningTimeframe; label: string }[] = [
  { value: "monthly", label: "This Month" },
  { value: "quarterly", label: "This Quarter" },
  { value: "yearly", label: "This Year" },
  { value: "custom", label: "Custom" },
];
const COMPANY_TABS = ["All Companies", "Uncle Bills", "Aiwibi Uganda"] as const;

function shortDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function isoMonthStart(offsetMonths = 0) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offsetMonths, 1).toISOString().slice(0, 10);
}

function findMilestoneDate(shipment: Shipment | undefined, stepName: string): string {
  if (!shipment) return "";
  const milestone = shipment.milestones.find((m) => m.name === stepName);
  return milestone?.actualDate ?? milestone?.plannedDate ?? "";
}

function orderCycleLabel(order: PlannedOrder): string {
  const label = ORDER_FREQUENCY_LABELS[order.frequency];
  return order.frequency === "custom" && order.customIntervalDays
    ? `${label} (${order.customIntervalDays}d)`
    : label;
}

interface OrderPlanRow {
  order: PlannedOrder;
  date: Date;
  status: OccurrenceStatus;
  container: string;
  size: string;
  mombasaEta: string;
  storeDate: string;
  actual: string;
}

export function OrderPlanningView({
  plannedOrders,
  shipments,
  canManage,
}: {
  plannedOrders: PlannedOrder[];
  shipments: Shipment[];
  canManage: boolean;
}) {
  const [items, setItems] = useState(plannedOrders);
  const [timeframe, setTimeframe] = useState<OrderPlanningTimeframe>("monthly");
  const [companyTab, setCompanyTab] = useState<(typeof COMPANY_TABS)[number]>("All Companies");
  const [customStart, setCustomStart] = useState(isoMonthStart());
  const [customEnd, setCustomEnd] = useState(isoMonthStart(3));
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Due-soon reminders ignore the timeframe/company filters below on
  // purpose — they're the daily "act now" list, always for everything.
  const dueSoon = useMemo(() => getDueSoonOrders(items), [items]);

  const filteredOrders = useMemo(
    () =>
      items.filter(
        (o) => o.active && (companyTab === "All Companies" || o.company === companyTab)
      ),
    [items, companyTab]
  );

  const rows = useMemo<OrderPlanRow[]>(() => {
    const range = getTimeframeRange(timeframe, new Date(), { start: customStart, end: customEnd });
    return filteredOrders
      .flatMap((order) => getOrderOccurrences(order, range.start, range.end).map((date) => ({ order, date })))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(({ order, date }) => {
        const status = describeOccurrenceStatus(order, date);
        // Container-linked fields only mean anything for the occurrence
        // that's actually been placed — a schedule's future or past
        // cycles don't have a known container.
        const shipment =
          status === "Placed" && order.containerNumber
            ? shipments.find((s) => s.containerNumber === order.containerNumber)
            : undefined;
        // Live tracking data wins when it exists; otherwise fall back to
        // whatever was brought in by a bulk import for this same row.
        // Container/size are planning attributes of the schedule itself,
        // so — unlike ETA/Store/Actual below — they show on every
        // occurrence, not only the one that's actually been placed.
        return {
          order,
          date,
          status,
          container: order.containerNumber ?? "",
          size: order.containerSize ?? shipment?.containerSize ?? "",
          mombasaEta:
            findMilestoneDate(shipment, "Mombasa Port") ||
            (status === "Placed" ? order.importedMombasaEta ?? "" : ""),
          storeDate:
            findMilestoneDate(shipment, "Arrived at Store") ||
            (status === "Placed" ? order.importedStoreDate ?? "" : ""),
          actual:
            status === "Placed" ? order.importedActual || shortDate(date) : "",
        };
      });
  }, [filteredOrders, timeframe, customStart, customEnd, shipments]);

  function handlePlaced(orderId: string, newAnchorIso: string, containerNumber?: string) {
    setItems((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, anchorDate: newAnchorIso, containerNumber: containerNumber ?? o.containerNumber }
          : o
      )
    );
  }

  async function handleExportExcel() {
    setExportError(null);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Order Plan");

      sheet.columns = [
        { header: "Container Code", key: "container", width: 16 },
        { header: "Size", key: "size", width: 12 },
        { header: "Order Date", key: "orderDate", width: 14 },
        { header: "Order Cycle", key: "orderCycle", width: 18 },
        { header: "Leadtime", key: "leadtime", width: 12 },
        { header: "Mombasa ETA", key: "mombasaEta", width: 14 },
        { header: "Store Date", key: "storeDate", width: 14 },
        { header: "Actual", key: "actual", width: 14 },
        { header: "Status", key: "status", width: 14 },
      ];

      rows.forEach((r) => {
        sheet.addRow({
          container: r.container || "—",
          size: r.size || "—",
          orderDate: shortDate(r.date),
          orderCycle: orderCycleLabel(r.order),
          leadtime: `${r.order.leadTimeDays} days`,
          mombasaEta: r.mombasaEta || "—",
          storeDate: r.storeDate || "—",
          actual: r.actual || "—",
          status: r.status,
        });
      });

      const headerRow = sheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
      });
      const thinBorder: Partial<import("exceljs").Borders> = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      sheet.eachRow((row) => row.eachCell((cell) => (cell.border = thinBorder)));

      const dateLabel = new Date().toISOString().slice(0, 10);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `order-plan-${dateLabel}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Couldn't build the Excel file — try again.");
    }
  }

  return (
    <div className="space-y-4">
      <DueSoonBanner dueSoon={dueSoon} onPlaced={handlePlaced} />

      <div className="rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <FilterTabs
              options={TIMEFRAMES.map((t) => t.label)}
              active={TIMEFRAMES.find((t) => t.value === timeframe)?.label ?? ""}
              onChange={(label) =>
                setTimeframe(TIMEFRAMES.find((t) => t.label === label)?.value ?? "monthly")
              }
            />
            <FilterTabs
              options={[...COMPANY_TABS]}
              active={companyTab}
              onChange={(v) => setCompanyTab(v as (typeof COMPANY_TABS)[number])}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-secondary hover:bg-page"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </button>
            {canManage && (
              <button
                onClick={() => setImportModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-secondary hover:bg-page"
              >
                <Upload className="h-4 w-4" />
                Import Excel/CSV
              </button>
            )}
            {canManage && (
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90"
              >
                <Plus className="h-4 w-4" />
                Add schedule
              </button>
            )}
          </div>
        </div>

        {exportError && <p className="px-5 pt-3 text-xs text-danger">{exportError}</p>}

        {timeframe === "custom" && (
          <div className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-3">
            <label className="flex items-center gap-2 text-xs text-text-tertiary">
              From
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-text-tertiary">
              To
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
              />
            </label>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-tertiary">
                <th className="px-5 py-3 font-medium">Container Code</th>
                <th className="px-5 py-3 font-medium">Size</th>
                <th className="px-5 py-3 font-medium">Order Date</th>
                <th className="px-5 py-3 font-medium">Order Cycle</th>
                <th className="px-5 py-3 font-medium">Leadtime</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.order.id}-${i}`}
                  className="border-b border-border last:border-b-0 hover:bg-page"
                >
                  <td className="px-5 py-3.5 font-medium text-text-primary">{r.container || "—"}</td>
                  <td className="px-5 py-3.5 text-text-secondary">{r.size || "—"}</td>
                  <td className="px-5 py-3.5 text-text-secondary">{shortDate(r.date)}</td>
                  <td className="px-5 py-3.5 text-text-secondary">{orderCycleLabel(r.order)}</td>
                  <td className="px-5 py-3.5 text-text-secondary">{r.order.leadTimeDays} days</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-text-tertiary">
                    No orders scheduled in this timeframe.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddPlannedOrderModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={(order) => setItems((prev) => [order, ...prev])}
      />

      <ImportPlannedOrdersModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={(orders) => setItems((prev) => [...orders, ...prev])}
      />
    </div>
  );
}
