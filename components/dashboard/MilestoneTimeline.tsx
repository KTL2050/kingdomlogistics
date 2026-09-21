import {
  AlertTriangle,
  Anchor,
  ClipboardList,
  Home,
  Package,
  Ship,
  Truck,
} from "lucide-react";
import type { Shipment } from "@/types";
import { cn, milestoneStyles } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";

const STEP_ICONS = [ClipboardList, Package, Ship, Anchor, Truck, Home, Home];

export function MilestoneTimeline({ shipment }: { shipment: Shipment }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-sm font-semibold text-accent">
            {shipment.containerNumber}
          </div>
          <div>
            <div className="text-sm font-semibold text-text-primary">
              {shipment.containerNumber}
            </div>
            <div className="text-xs text-text-tertiary">
              {shipment.routeVia.join(" → ")}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs">
          <div>
            <div className="text-text-tertiary">Container Size</div>
            <div className="font-medium text-text-primary">
              {shipment.containerSize}
            </div>
          </div>
          <div>
            <div className="text-text-tertiary">Mode</div>
            <div className="font-medium text-text-primary">{shipment.mode}</div>
          </div>
          <div>
            <div className="text-text-tertiary">ETD</div>
            <div className="font-medium text-text-primary">
              {new Date(shipment.etd).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
          <div>
            <div className="text-text-tertiary">Final ETA</div>
            <div className="font-medium text-text-primary">
              {new Date(shipment.finalEta).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
        </div>

        <div className="text-right">
          <StatusBadge health={shipment.health} delayDays={shipment.delayDays} />
          <div className="mt-1 text-[11px] text-text-tertiary">
            {shipment.health === "delayed" ? "Behind schedule" : "On schedule"}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-start overflow-x-auto pb-1">
        {shipment.milestones.map((m, i) => {
          const style = milestoneStyles[m.status];
          const Icon = STEP_ICONS[i] ?? Package;
          const isLast = i === shipment.milestones.length - 1;
          return (
            <div
              key={m.id}
              className="flex min-w-[112px] flex-1 flex-col items-center text-center"
            >
              <div className="flex w-full items-center">
                <div
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    style.circle
                  )}
                >
                  {m.status === "delayed" ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  ) : (
                    m.order
                  )}
                </div>
                {!isLast && (
                  <div className={cn("mx-1 h-0.5 flex-1", style.line)} />
                )}
              </div>

              <div className="mt-2 flex flex-col items-center gap-0.5">
                <Icon
                  className={cn(
                    "h-4 w-4",
                    m.status === "pending" ? "text-text-tertiary" : "text-text-secondary"
                  )}
                />
                <div className={cn("text-[12px] font-medium", style.text)}>
                  {m.name}
                </div>
                <div className="text-[11px] text-text-tertiary">
                  {m.durationLabel}
                </div>
              </div>

              <div className="mt-2 flex w-full justify-center gap-3 text-[10.5px]">
                <div>
                  <div className="text-text-tertiary">Planned</div>
                  <div className="font-medium text-text-secondary">
                    {m.plannedDate}
                  </div>
                </div>
                <div>
                  <div className="text-text-tertiary">Actual</div>
                  <div
                    className={cn(
                      "font-medium",
                      m.status === "delayed"
                        ? "text-danger"
                        : m.actualDate
                        ? "text-success"
                        : "text-text-tertiary"
                    )}
                  >
                    {m.actualDate ?? "Not reached"}
                    {m.status === "delayed" && (
                      <div className="text-[10px] text-danger">
                        ({shipment.delayDays} days late)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {shipment.delayReason && (
        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger-soft px-3.5 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div className="flex-1 text-[12px]">
            <span className="font-medium text-danger">{shipment.delayReason}</span>
          </div>
          {shipment.delayReportedAt && (
            <div className="shrink-0 text-[11px] text-text-tertiary">
              Reported: {shipment.delayReportedAt}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
