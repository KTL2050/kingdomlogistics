"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { dueSoonSeverity, type DueSoonOrder } from "@/lib/order-planning";

function shortDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const SEVERITY_STYLE = {
  critical: { text: "text-danger", bg: "bg-danger-soft" },
  warning: { text: "text-warning", bg: "bg-warning-soft" },
  info: { text: "text-info", bg: "bg-info-soft" },
};

export function DueSoonBanner({
  dueSoon,
  onPlaced,
}: {
  dueSoon: DueSoonOrder[];
  onPlaced: (orderId: string, newAnchorIso: string, containerNumber?: string) => void;
}) {
  const [placing, setPlacing] = useState<string | null>(null);
  const [containerInputs, setContainerInputs] = useState<Record<string, string>>({});

  if (dueSoon.length === 0) return null;

  // Moving anchor_date to today re-bases the recurrence from here, so
  // this schedule's next due date is computed fresh from the real
  // placement date instead of drifting off the original one. Recording
  // the container here — right when it's actually known — is what lets
  // the Order Planning export pull that container's real Mombasa ETA /
  // Store Date instead of leaving them blank.
  async function handleMarkPlaced(orderId: string) {
    setPlacing(orderId);
    const todayIso = new Date().toISOString().slice(0, 10);
    const containerNumber = containerInputs[orderId]?.trim() || undefined;

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from("planned_orders")
        .update({ anchor_date: todayIso, container_number: containerNumber ?? null })
        .eq("id", orderId);
      if (error) {
        setPlacing(null);
        return;
      }
    }

    onPlaced(orderId, todayIso, containerNumber);
    setPlacing(null);
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-5 py-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-text-primary">
          <AlertCircle className="h-4 w-4 text-warning" />
          Orders due soon
          <span className="text-text-tertiary">({dueSoon.length})</span>
        </h2>
        <p className="mt-1 text-[12.5px] text-text-secondary">
          Stays here every day until the order is placed, so nothing slips
          past its window.
        </p>
      </div>
      <div>
        {dueSoon.map(({ order, nextOccurrence, daysUntil, overdue }) => {
          const style = SEVERITY_STYLE[dueSoonSeverity(daysUntil)];
          return (
            <div
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    style.bg
                  )}
                >
                  <AlertCircle className={cn("h-4 w-4", style.text)} />
                </span>
                <div>
                  <div className="text-[13px] font-medium text-text-primary">
                    {order.company} — {shortDate(nextOccurrence)}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {overdue
                      ? `${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? "" : "s"} overdue`
                      : daysUntil === 0
                      ? "Due today"
                      : `Due in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`}
                    {order.notes ? ` · ${order.notes}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Container # (optional)"
                  value={containerInputs[order.id] ?? ""}
                  onChange={(e) =>
                    setContainerInputs((prev) => ({ ...prev, [order.id]: e.target.value }))
                  }
                  className="w-32 rounded-md border border-border px-2 py-1.5 text-[11px] focus:border-accent focus:outline-none"
                />
                <button
                  onClick={() => handleMarkPlaced(order.id)}
                  disabled={placing === order.id}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-text-secondary hover:bg-page disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {placing === order.id ? "…" : "Mark as placed"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
