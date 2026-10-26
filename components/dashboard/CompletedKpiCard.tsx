"use client";

import { useState } from "react";
import Link from "next/link";
import { PackageCheck, X } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { actualDateToIso } from "@/lib/milestone-eval";
import { getCompanyForContainer } from "@/lib/utils";
import type { Shipment } from "@/types";

// The store-arrival date is saved without a year ("24 Oct"), so the year is
// worked back out from the order date.
function arrival(s: Shipment) {
  const last = s.milestones[s.milestones.length - 1];
  const iso = last?.actualDate ? actualDateToIso(last.actualDate, s.etd) : null;
  const lateBy = last?.status === "delayed" ? last.daysLate ?? s.delayDays : 0;
  return { iso, lateBy };
}

export function CompletedKpiCard({ completed, total }: { completed: Shipment[]; total: number }) {
  const [open, setOpen] = useState(false);

  const rows = completed
    .map((s) => ({ s, ...arrival(s) }))
    .sort((a, b) => (b.iso ? Date.parse(b.iso) : 0) - (a.iso ? Date.parse(a.iso) : 0));
  const pct = total > 0 ? ((completed.length / total) * 100).toFixed(1) : "0.0";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Show completed containers"
        className="block w-full rounded-xl text-left transition hover:shadow-sm"
      >
        <KpiCard
          icon={PackageCheck}
          label="Completed"
          value={completed.length}
          supporting={`${pct}% of total`}
          tone="success"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/30 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl border border-border bg-surface shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold text-text-primary">Completed containers</h2>
                <p className="text-[12px] text-text-tertiary">
                  {completed.length} arrived at the store
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-tertiary hover:bg-page"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto">
              {rows.length === 0 && (
                <p className="px-5 py-8 text-center text-[12.5px] text-text-tertiary">
                  No completed containers yet.
                </p>
              )}
              {rows.map(({ s, iso, lateBy }) => (
                <Link
                  key={s.id}
                  href={`/shipments/${s.containerNumber}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-b-0 hover:bg-page"
                >
                  <div>
                    <div className="text-[13px] font-semibold text-text-primary">{s.containerNumber}</div>
                    <div className="text-[11px] text-text-tertiary">
                      {getCompanyForContainer(s.containerNumber)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12.5px] font-medium text-text-primary">
                      {iso
                        ? new Date(iso).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "Date not recorded"}
                    </div>
                    <div className={lateBy > 0 ? "text-[11px] text-danger" : "text-[11px] text-success"}>
                      {lateBy > 0 ? `${lateBy} day${lateBy === 1 ? "" : "s"} late` : "On time"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
