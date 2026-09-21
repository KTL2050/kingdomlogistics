"use client";

import { useMemo, useState } from "react";
import { Download, SlidersHorizontal } from "lucide-react";
import { FilterTabs } from "@/components/ui/FilterButton";
import { MilestoneTimeline } from "@/components/dashboard/MilestoneTimeline";
import { cn } from "@/lib/utils";
import type { Shipment } from "@/types";

const TABS = ["All", "On Time", "Delayed", "In Transit", "Completed"] as const;

function matchesTab(shipment: Shipment, tab: (typeof TABS)[number]) {
  if (tab === "All") return true;
  if (tab === "On Time") return shipment.health === "on_time";
  if (tab === "Delayed") return shipment.health === "delayed";
  if (tab === "Completed") return shipment.health === "completed";
  if (tab === "In Transit")
    return shipment.health === "on_time" || shipment.health === "delayed";
  return true;
}

export function ContainerMilestoneSection({
  shipments,
}: {
  shipments: Shipment[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const defaultSelection =
    shipments.find((s) => s.health === "delayed")?.containerNumber ??
    shipments[0]?.containerNumber ??
    "";
  const [selected, setSelected] = useState(defaultSelection);

  const filtered = useMemo(
    () => shipments.filter((s) => matchesTab(s, tab)),
    [shipments, tab]
  );

  const active =
    filtered.find((s) => s.containerNumber === selected) ?? filtered[0];

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold text-text-primary">
          Container milestone tracking
        </h2>
        <div className="flex items-center gap-3">
          <FilterTabs options={[...TABS]} active={tab} onChange={(v) => setTab(v as (typeof TABS)[number])} />
          <button className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-medium text-text-secondary hover:bg-page">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-medium text-text-secondary hover:bg-page">
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {filtered.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s.containerNumber)}
            className={cn(
              "shrink-0 rounded-lg border px-2.5 py-1 text-[12.5px] font-medium transition-colors",
              active?.containerNumber === s.containerNumber
                ? "border-accent bg-accent-soft text-accent"
                : "border-border text-text-secondary hover:bg-page"
            )}
          >
            {s.containerNumber}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {active ? (
          <MilestoneTimeline shipment={active} />
        ) : (
          <div className="rounded-lg border border-border py-10 text-center text-sm text-text-tertiary">
            No containers match this filter.
          </div>
        )}
      </div>
    </div>
  );
}
