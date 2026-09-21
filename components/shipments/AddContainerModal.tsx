"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { buildMilestones, getRouteStepsForContainer } from "@/lib/mock-data";
import { getCompanyForContainer } from "@/lib/utils";
import { computePlannedDates } from "@/lib/planning";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type { ContainerSize, Shipment } from "@/types";

const SIZES: ContainerSize[] = ["20ft", "40ft", "40ft HC", "45ft"];

// Fallback durations if Stage Durations settings haven't been
// configured yet (or Supabase isn't connected) — same figures used
// across the sample data.
const FALLBACK_DAYS: Record<string, number> = {
  "Order Placed": 10,
  "Container Loaded": 2,
  "On the High Seas": 35,
  "Mombasa Port": 3,
  "Enroute to Kampala": 3,
  "At ICD": 1,
  "Arrived at Store": 1,
};

function shortLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function AddContainerModal({
  open,
  onClose,
  onAdd,
  existingCodes,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (shipment: Shipment) => void;
  existingCodes: string[];
}) {
  const [code, setCode] = useState("");
  const [size, setSize] = useState<ContainerSize>("40ft");
  const [orderDate, setOrderDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expectedDays, setExpectedDays] = useState<Record<string, number>>(FALLBACK_DAYS);

  // Load the real Stage Durations settings once, so new containers get
  // properly computed Planned dates instead of "TBD" for every step
  // past Order Placed.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase
      .from("stage_durations")
      .select("*")
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, number> = {};
        for (const d of data) map[d.step_name as string] = d.expected_days as number;
        setExpectedDays(map);
      });
  }, []);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    const company = getCompanyForContainer(trimmed);

    if (!trimmed) {
      setError("Enter a container code.");
      return;
    }
    if (company === "Unknown") {
      setError("Container code must start with C (Uncle Bills) or A (Aiwibi Uganda).");
      return;
    }
    if (existingCodes.includes(trimmed)) {
      setError(`Container ${trimmed} is already being tracked.`);
      return;
    }
    if (!orderDate) {
      setError("Select the date the order was placed.");
      return;
    }

    const finalEta = addDays(orderDate, 28);
    const steps = getRouteStepsForContainer(trimmed);
    const plannedSteps = computePlannedDates(steps, orderDate, expectedDays);
    const plans = steps.map((_, i) => ({
      planned: plannedSteps[i].plannedDate,
      plannedIso: plannedSteps[i].plannedDateIso,
      actual: i === 0 ? shortLabel(orderDate) : null,
      duration: plannedSteps[i].durationLabel,
    }));

    const shipment: Shipment = {
      id: `s-${trimmed.toLowerCase()}-${Date.now()}`,
      shipmentNumber: `SHP-${trimmed}`,
      containerNumber: trimmed,
      origin: "China",
      destination: "Kampala",
      routeVia: ["China", "Mombasa", "Kampala"],
      shippingLine: "TBD",
      containerSize: size,
      mode: "FCL",
      etd: orderDate,
      eta: finalEta,
      finalEta,
      currentStatus: "Order Placed",
      currentLocation: "Origin Warehouse",
      health: "not_started",
      delayDays: 0,
      customer: company,
      position: { lat: 31.23, lng: 121.47, label: "China" },
      milestones: buildMilestones(steps, plans, 0, false),
    };

    // Persist to Supabase when it's configured, so this survives a page
    // refresh — previously this only ever lived in this tab's memory.
    // Falls back to local-only when running on the bundled mock data.
    if (isSupabaseConfigured && supabase) {
      setSaving(true);
      const { data: inserted, error: insertError } = await supabase
        .from("shipments")
        .insert({
          shipment_number: shipment.shipmentNumber,
          container_number: shipment.containerNumber,
          origin: shipment.origin,
          destination: shipment.destination,
          route_via: shipment.routeVia,
          shipping_line: shipment.shippingLine,
          container_size: shipment.containerSize,
          mode: shipment.mode,
          etd: shipment.etd,
          eta: shipment.eta,
          final_eta: shipment.finalEta,
          current_status: shipment.currentStatus,
          current_location: shipment.currentLocation,
          health: shipment.health,
          delay_days: shipment.delayDays,
          customer: shipment.customer,
          position: shipment.position,
          milestones: shipment.milestones,
        })
        .select()
        .single();

      setSaving(false);
      if (insertError) {
        setError(insertError.message);
        return;
      }
      shipment.id = inserted.id;
    }

    onAdd(shipment);
    setCode("");
    setSize("40ft");
    setOrderDate("");
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-text-primary">Add container</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-page"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-[12.5px] text-text-secondary">
          The company is detected automatically from the code — C for Uncle
          Bills, A for Aiwibi Uganda.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="text-xs text-text-tertiary">Container code</label>
            <input
              autoFocus
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              placeholder="e.g. C41 or A15"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-text-tertiary">Container size</label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value as ContainerSize)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {SIZES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-text-tertiary">Order placed on</label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => {
                setOrderDate(e.target.value);
                setError(null);
              }}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-text-secondary hover:bg-page"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add container"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}