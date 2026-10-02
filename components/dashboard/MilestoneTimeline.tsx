"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Anchor,
  ClipboardList,
  Home,
  MessageSquarePlus,
  Package,
  Ship,
  Truck,
} from "lucide-react";
import type { Shipment } from "@/types";
import { cn, milestoneStyles } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MilestoneReasonModal } from "@/components/dashboard/MilestoneReasonModal";

const STEP_ICONS = [ClipboardList, Package, Ship, Anchor, Truck, Home, Home];

export function MilestoneTimeline({
  shipment,
  canEditReasons = false,
  currentUserName,
}: {
  shipment: Shipment;
  /** Only Logistics Manager, same as sending inland progress updates —
   * adding a reason retroactively is the same kind of action. */
  canEditReasons?: boolean;
  currentUserName?: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingMilestone = shipment.milestones.find((m) => m.id === editingId);

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

        <div className="flex flex-wrap items-start gap-x-8 gap-y-2 text-xs">
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
          {/* Kept in the same flex-wrap flow as the fields above (rather
              than a separate flex item) so it lands right after Final ETA
              on whichever line has room, instead of always dropping to
              its own row on narrow screens. */}
          <div className="text-right">
            <StatusBadge health={shipment.health} delayDays={shipment.delayDays} />
            <div className="mt-1 text-[11px] text-text-tertiary">
              {shipment.health === "delayed" ? "Behind schedule" : "On schedule"}
            </div>
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

              {canEditReasons && m.actualDate && (
                <button
                  type="button"
                  onClick={() => setEditingId(m.id)}
                  className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-text-tertiary hover:text-accent"
                >
                  <MessageSquarePlus className="h-3 w-3" />
                  {m.delayReason ? "Edit reason" : "Add reason"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Each stage's own reason, so an earlier one (e.g. Mombasa Port)
          stays visible even after a later stage also goes delayed —
          unlike a single shared field, which only ever shows the most
          recent. */}
      {shipment.milestones
        .filter((m) => m.delayReason)
        .map((m) => (
          <div
            key={m.id}
            className="mt-3 flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger-soft px-3.5 py-2.5"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <div className="flex-1 text-[12px]">
              <span className="font-medium text-text-primary">{m.name}:</span>{" "}
              <span className="text-danger">{m.delayReason}</span>
            </div>
            {m.delayReportedAt && (
              <div className="shrink-0 text-[11px] text-text-tertiary">
                Reported: {m.delayReportedAt}
              </div>
            )}
          </div>
        ))}

      {editingMilestone && (
        <MilestoneReasonModal
          shipmentId={shipment.id}
          containerNumber={shipment.containerNumber}
          milestones={shipment.milestones}
          milestone={editingMilestone}
          currentUserName={currentUserName}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
