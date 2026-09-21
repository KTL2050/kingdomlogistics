"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { checkDelay, buildDelayReason } from "@/lib/delay";
import type { Milestone } from "@/types";

function shortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ManualProgressForm({
  shipmentId,
  containerNumber,
  steps,
  milestones,
}: {
  shipmentId: string;
  containerNumber: string;
  steps: readonly string[];
  milestones: Milestone[];
}) {
  const router = useRouter();
  const mombasaIndex = steps.indexOf("Mombasa Port");
  const mombasaMilestone = milestones[mombasaIndex];

  // The next stage still needing a manual update — the first one after
  // Mombasa Port that isn't already marked completed.
  const nextIndex = milestones.findIndex((m, i) => i > mombasaIndex && m.status !== "completed");

  const [date, setDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Ocean leg isn't confirmed at Mombasa yet — nothing to mark manually
  // until Traqo (or a manual sync) confirms that first.
  if (!mombasaMilestone || mombasaMilestone.status !== "completed") {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-text-tertiary" />
          <h2 className="text-[14px] font-semibold text-text-primary">Inland progress</h2>
        </div>
        <p className="mt-1 text-[12px] text-text-secondary">
          This becomes available once tracking confirms arrival at Mombasa Port.
        </p>
      </div>
    );
  }

  // Every remaining stage is already marked complete.
  if (nextIndex === -1) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-success" />
          <h2 className="text-[14px] font-semibold text-text-primary">Inland progress</h2>
        </div>
        <p className="mt-1 text-[12px] text-text-secondary">
          All inland stages have been marked complete.
        </p>
      </div>
    );
  }

  const stageName = steps[nextIndex];
  const isFinalStage = nextIndex === steps.length - 1;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    // date is already ISO (from the date input) — compare it against
    // this stage's planned date the same way the automatic Traqo sync
    // does, so a late manual update gets flagged exactly like a late
    // carrier-confirmed one would.
    const actualIso = new Date(date).toISOString();
    const plannedIso = milestones[nextIndex].plannedDateIso;
    const delayResult = checkDelay(plannedIso, actualIso);
    const wasAlreadyDelayed = milestones[nextIndex].status === "delayed";

    const updated = milestones.map((m, i) => {
      if (i === nextIndex) {
        return {
          ...m,
          status: delayResult.isDelayed ? ("delayed" as const) : ("completed" as const),
          actualDate: shortDate(date),
        };
      }
      if (i === nextIndex + 1 && m.status === "pending") {
        return { ...m, status: "current" as const };
      }
      return m;
    });

    const isNewDelay = delayResult.isDelayed && !wasAlreadyDelayed;
    const delayReason =
      isNewDelay && plannedIso
        ? buildDelayReason(stageName, plannedIso, actualIso, delayResult.daysLate)
        : undefined;

    const { error: updateError } = await supabase
      .from("shipments")
      .update({
        milestones: updated,
        current_status: stageName,
        current_location: stageName,
        health: delayResult.isDelayed ? "delayed" : isFinalStage ? "completed" : undefined,
        ...(isNewDelay && {
          delay_days: delayResult.daysLate,
          delay_reason: delayReason,
          delay_reported_at: shortDate(new Date().toISOString()),
        }),
      })
      .eq("id", shipmentId);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    if (isNewDelay && delayReason) {
      await supabase.from("alerts").insert({
        severity: "warning",
        shipment_number: containerNumber,
        title: `Delay at ${stageName}`,
        description: delayReason,
        acknowledged: false,
      });
    }

    setSaving(false);
    setSuccess(true);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-accent" />
        <h2 className="text-[14px] font-semibold text-text-primary">Inland progress</h2>
      </div>
      <p className="mt-1 text-[12px] text-text-secondary">
        Carrier tracking stops at Mombasa Port — mark each remaining stage
        yourself as the container actually reaches it.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <label className="text-[11px] text-text-tertiary">Next stage</label>
          <div className="mt-1 rounded-lg border border-border bg-page px-3 py-2 text-[13px] font-medium text-text-primary">
            {stageName}
          </div>
        </div>
        <div>
          <label className="text-[11px] text-text-tertiary">Date reached</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 rounded-lg border border-border px-3 py-2 text-[13px] focus:border-accent focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : `Mark "${stageName}" reached`}
        </button>
      </form>

      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      {success && <p className="mt-2 text-[12px] text-success">Updated.</p>}
    </div>
  );
}