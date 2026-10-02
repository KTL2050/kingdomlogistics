"use client";

import Link from "next/link";
import { AlertCircle, AlertTriangle, Calendar, Info, X } from "lucide-react";
import type { Alert } from "@/types";
import { cn, severityStyles } from "@/lib/utils";

const SEVERITY_ICON = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_LABEL = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

export function AlertDetailModal({ alert, onClose }: { alert: Alert; onClose: () => void }) {
  const style = severityStyles[alert.severity];
  const Icon = SEVERITY_ICON[alert.severity];

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/30 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                style.bg
              )}
            >
              <Icon className={cn("h-4 w-4", style.text)} />
            </div>
            <div>
              <span className={cn("text-[10px] font-semibold uppercase tracking-wide", style.text)}>
                {SEVERITY_LABEL[alert.severity]}
              </span>
              <h2 className="text-[15px] font-semibold leading-tight text-text-primary">
                {alert.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-tertiary hover:bg-page"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-[13px] text-text-secondary">{alert.description}</p>

        {alert.managerNote && (
          <div className="mt-3 rounded-md border border-info/20 bg-info-soft px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-info">
              Manager&apos;s note
            </p>
            <p className="mt-1 text-[13px] text-text-primary">{alert.managerNote}</p>
            <p className="mt-1.5 text-[11px] text-text-tertiary">
              — {alert.managerNoteBy ?? "Unknown"}
              {alert.managerNoteAt ? `, ${alert.managerNoteAt}` : ""}
            </p>
          </div>
        )}

        {alert.expectedNextStage && alert.expectedNextDate && (
          <div className="mt-3 flex items-center gap-1.5 text-[12.5px] text-text-secondary">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
            Expected to reach {alert.expectedNextStage} by{" "}
            <span className="font-medium text-text-primary">{alert.expectedNextDate}</span>
          </div>
        )}

        <p className="mt-3 text-[11px] text-text-tertiary">{alert.timestamp}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          {alert.shipmentNumber ? (
            <Link
              href={`/shipments/${alert.shipmentNumber}`}
              onClick={onClose}
              className="text-[12.5px] font-medium text-accent hover:underline"
            >
              View shipment {alert.shipmentNumber} →
            </Link>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-text-secondary hover:bg-page"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
