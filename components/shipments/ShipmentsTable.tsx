"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { SearchBar } from "@/components/ui/SearchBar";
import { FilterTabs } from "@/components/ui/FilterButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CompanyBadge } from "@/components/ui/CompanyBadge";
import { AddContainerModal } from "@/components/shipments/AddContainerModal";
import { getCompanyForContainer } from "@/lib/utils";
import type { Shipment } from "@/types";

const TABS = ["All", "On Time", "Delayed", "Not Started", "Completed"] as const;
const COMPANY_TABS = ["All Companies", "Uncle Bills", "Aiwibi Uganda"] as const;

export function ShipmentsTable({ shipments }: { shipments: Shipment[] }) {
  const [items, setItems] = useState(shipments);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [companyTab, setCompanyTab] = useState<(typeof COMPANY_TABS)[number]>("All Companies");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    return items.filter((s) => {
      const matchesTab =
        tab === "All" ||
        (tab === "On Time" && s.health === "on_time") ||
        (tab === "Delayed" && s.health === "delayed") ||
        (tab === "Not Started" && s.health === "not_started") ||
        (tab === "Completed" && s.health === "completed");

      const matchesCompany =
        companyTab === "All Companies" ||
        getCompanyForContainer(s.containerNumber) === companyTab;

      const q = query.trim().toLowerCase();
      const matchesQuery =
        q === "" ||
        s.containerNumber.toLowerCase().includes(q) ||
        s.shipmentNumber.toLowerCase().includes(q) ||
        s.customer.toLowerCase().includes(q);

      return matchesTab && matchesCompany && matchesQuery;
    });
  }, [items, tab, companyTab, query]);

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterTabs options={[...TABS]} active={tab} onChange={(v) => setTab(v as (typeof TABS)[number])} />
          <FilterTabs
            options={[...COMPANY_TABS]}
            active={companyTab}
            onChange={(v) => setCompanyTab(v as (typeof COMPANY_TABS)[number])}
          />
        </div>
        <div className="flex items-center gap-3">
          <SearchBar
            placeholder="Search shipment, container or customer"
            value={query}
            onChange={setQuery}
          />
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            <Plus className="h-4 w-4" />
            Add container
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-tertiary">
              <th className="px-5 py-3 font-medium">Container</th>
              <th className="px-5 py-3 font-medium">Company</th>
              <th className="px-5 py-3 font-medium">Route</th>
              <th className="px-5 py-3 font-medium">Shipping Line</th>
              <th className="px-5 py-3 font-medium">Mode / Size</th>
              <th className="px-5 py-3 font-medium">ETA</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-b-0 hover:bg-page">
                <td className="px-5 py-3.5">
                  <Link
                    href={`/shipments/${s.containerNumber}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {s.containerNumber}
                  </Link>
                  <div className="text-xs text-text-tertiary">{s.shipmentNumber}</div>
                </td>
                <td className="px-5 py-3.5">
                  <CompanyBadge containerNumber={s.containerNumber} />
                </td>
                <td className="px-5 py-3.5 text-text-secondary">
                  {s.routeVia.join(" → ")}
                </td>
                <td className="px-5 py-3.5 text-text-secondary">{s.shippingLine}</td>
                <td className="px-5 py-3.5 text-text-secondary">
                  {s.mode} · {s.containerSize}
                </td>
                <td className="px-5 py-3.5 text-text-secondary">
                  {new Date(s.finalEta).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                  })}
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge health={s.health} delayDays={s.delayDays} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-text-tertiary">
                  No shipments match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddContainerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={(newShipment) => setItems((prev) => [newShipment, ...prev])}
        existingCodes={items.map((s) => s.containerNumber)}
      />
    </div>
  );
}
