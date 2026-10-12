"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Factory } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { buildDelayReason, checkDelay } from "@/lib/delay";
import { MANUFACTURING_STEP } from "@/lib/mock-data";
import type { Milestone } from "@/types";

function shortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ManufacturingProgressForm({
  shipmentId,
  containerNumber,
  steps,
  milestones,
  currentUserName,
}: {
  shipmentId: string;
  containerNumber: string;
  steps: readonly string[];
  milestones: Milestone[];
  currentUserName?: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(todayIso());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const index = steps.indexOf(MANUFACTURING_STEP);
  const milestone = milestones[index];
  const loaded = milestones[steps.indexOf("Container Loaded")];

  // Only Aiwibi routes have this stage, and the card only makes sense until
  // the stage is done or the container has already been loaded.
  if (index === -1 || !milestone) return null;
  if (milestone.status === "completed" || milestone.status === "delayed") return null;
  if (loaded && (loaded.status === "current" || loaded.status === "completed" || loaded.status === "delayed")) {
    return null;
  }

  const actualIso = date ? new Date(date).toISOString() : "";
  const check = actualIso
    ? checkDelay(milestone.plannedDateIso, actualIso)
    : { isDelayed: false, daysLate: 0 };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !date) return;
    if (check.isDelayed && !reason.trim()) {
      setError("This is later than planned — enter the reason for the delay.");
      return;
    }
    setSaving(true);
    setError(null);

    const delayReason =
      check.isDelayed && milestone.plannedDateIso
        ? buildDelayReason(MANUFACTURING_STEP, milestone.plannedDateIso, actualIso, check.daysLate)
        : undefined;

    const updated = milestones.map((m, i) =>
      i === index
        ? {
            ...m,
            status: check.isDelayed ? ("delayed" as const) : ("completed" as const),
            actualDate: shortDate(date),
            ...(check.isDelayed && delayReason
              ? {
                  daysLate: check.daysLate,
                  delayReason,
                  delayReportedAt: shortDate(new Date().toISOString()),
                }
              : {}),
          }
        : m
    );

    const { error: updateError } = await supabase
      .from("shipments")
      .update({
        milestones: updated,
        current_status: MANUFACTURING_STEP,
        ...(check.isDelayed && { health: "delayed", delay_days: check.daysLate }),
      })
      .eq("id", shipmentId);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    const { error: alertError } = await supabase.from("alerts").insert({
      severity: check.isDelayed ? "warning" : "info",
      shipment_number: containerNumber,
      title: MANUFACTURING_STEP,
      description:
        delayReason ?? "Manufacturing and packaging is complete. The container is ready to be loaded.",
      acknowledged: false,
      ...(reason.trim() && {
        manager_note: reason.trim(),
        manager_note_by: currentUserName ?? null,
        manager_note_at: new Date().toISOString(),
      }),
    });

    setSaving(false);
    if (alertError) {
      // The update itself saved — only the team notification failed, which
      // must still surface or it looks like everyone was told.
      setError(`Update saved, but the team notification failed: ${alertError.message}`);
      router.refresh();
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Factory className="h-4 w-4 text-text-tertiary" />
        <h2 className="text-[14px] font-semibold text-text-primary">{MANUFACTURING_STEP}</h2>
      </div>
      <p className="mt-1 text-[12px] text-text-secondary">
        Record the date manufacturing and packaging finished. Planned: {milestone.plannedDate}.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-[12px] text-text-tertiary">Date completed</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-[13px] focus:border-accent focus:outline-none"
          />
        </div>

        {check.isDelayed && (
          <p className="text-[12px] text-danger">
            {check.daysLate} day{check.daysLate === 1 ? "" : "s"} later than planned — a reason is
            required.
          </p>
        )}

        <div>
          <label className="mb-1 block text-[12px] text-text-tertiary">
            {check.isDelayed ? "Reason for the delay" : "Note (optional)"}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-border px-3 py-2 text-[13px] focus:border-accent focus:outline-none"
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Mark as complete and notify the team"}
        </button>
      </form>
    </div>
  );
}
