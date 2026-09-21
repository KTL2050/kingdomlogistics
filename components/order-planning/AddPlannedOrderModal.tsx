"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type { ContainerSize, OrderFrequency, PlannedOrder } from "@/types";

const COMPANIES: PlannedOrder["company"][] = ["Uncle Bills", "Aiwibi Uganda"];
const SIZES: ContainerSize[] = ["20ft", "40ft", "40ft HC", "45ft"];
const FREQUENCIES: { value: OrderFrequency; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom interval" },
];

export function AddPlannedOrderModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (order: PlannedOrder) => void;
}) {
  const [company, setCompany] = useState<PlannedOrder["company"]>("Uncle Bills");
  const [frequency, setFrequency] = useState<OrderFrequency>("monthly");
  const [customIntervalDays, setCustomIntervalDays] = useState(30);
  const [anchorDate, setAnchorDate] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState(7);
  const [notes, setNotes] = useState("");
  const [containerNumber, setContainerNumber] = useState("");
  const [containerSize, setContainerSize] = useState<ContainerSize>("40ft");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!anchorDate) {
      setError("Pick a date for the next (or most recent) order in this schedule.");
      return;
    }

    const order: PlannedOrder = {
      id: `po-${Date.now()}`,
      company,
      frequency,
      customIntervalDays: frequency === "custom" ? customIntervalDays : undefined,
      anchorDate,
      leadTimeDays,
      notes: notes.trim() || undefined,
      active: true,
      containerNumber: containerNumber.trim() || undefined,
      containerSize,
    };

    // Persist to Supabase when it's configured, so this survives a page
    // refresh — falls back to local-only when running on mock data,
    // same as AddContainerModal.
    if (isSupabaseConfigured && supabase) {
      setSaving(true);
      const { data: inserted, error: insertError } = await supabase
        .from("planned_orders")
        .insert({
          company: order.company,
          frequency: order.frequency,
          custom_interval_days: order.customIntervalDays ?? null,
          anchor_date: order.anchorDate,
          lead_time_days: order.leadTimeDays,
          notes: order.notes ?? null,
          active: true,
          container_number: order.containerNumber ?? null,
          container_size: order.containerSize ?? null,
        })
        .select()
        .single();

      setSaving(false);
      if (insertError) {
        setError(insertError.message);
        return;
      }
      order.id = inserted.id;
    }

    onAdd(order);
    setCompany("Uncle Bills");
    setFrequency("monthly");
    setCustomIntervalDays(30);
    setAnchorDate("");
    setLeadTimeDays(7);
    setNotes("");
    setContainerNumber("");
    setContainerSize("40ft");
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-text-primary">Add order schedule</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-page"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-[12.5px] text-text-secondary">
          A recurring schedule for when this company&apos;s next order is
          due — not a single order.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="text-xs text-text-tertiary">Company</label>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value as PlannedOrder["company"])}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {COMPANIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-text-tertiary">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as OrderFrequency)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {frequency === "custom" && (
            <div>
              <label className="text-xs text-text-tertiary">Days between orders</label>
              <input
                type="number"
                min={1}
                value={customIntervalDays}
                onChange={(e) => setCustomIntervalDays(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-text-tertiary">
              Next (or most recent) order date
            </label>
            <input
              type="date"
              value={anchorDate}
              onChange={(e) => {
                setAnchorDate(e.target.value);
                setError(null);
              }}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-text-tertiary">Remind this many days before</label>
            <input
              type="number"
              min={1}
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-text-tertiary">
              Container # (optional, if already known)
            </label>
            <input
              type="text"
              value={containerNumber}
              onChange={(e) => setContainerNumber(e.target.value)}
              placeholder="e.g. C41"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-text-tertiary">Container size</label>
            <select
              value={containerSize}
              onChange={(e) => setContainerSize(e.target.value as ContainerSize)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {SIZES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-text-tertiary">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
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
              {saving ? "Saving…" : "Add schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
