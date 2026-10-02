"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { checkDelay, buildDelayReason } from "@/lib/delay";
import { detectStageIndex } from "@/lib/location-detect";
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
  currentUserName,
}: {
  shipmentId: string;
  containerNumber: string;
  steps: readonly string[];
  milestones: Milestone[];
  currentUserName?: string;
}) {
  const router = useRouter();
  const mombasaIndex = steps.indexOf("Mombasa Port");
  const mombasaMilestone = milestones[mombasaIndex];
  // A stage that was reached late is still reached — its status stays
  // "delayed" rather than flipping to "completed", so checking actualDate
  // directly (not the status string) is what correctly distinguishes
  // "hasn't arrived yet" from "arrived, on time or not".
  const mombasaReached = Boolean(mombasaMilestone?.actualDate);

  // The next stage still needing an update — the first one after Mombasa
  // Port that isn't already marked completed. This is also the floor for
  // what a manager can select: you can report being further ahead (the
  // container clearly passed through here already), never further back.
  const nextIndex = milestones.findIndex((m, i) => i > mombasaIndex && m.status !== "completed");

  const [location, setLocation] = useState("");
  // null = no manual pick yet, so the detected guess (if any) applies.
  // Cleared whenever the location text changes, so retyping a fresh
  // description lets detection take over again instead of being stuck
  // on a stale manual choice.
  const [overrideIndex, setOverrideIndex] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  const [reason, setReason] = useState("");
  const [expectedNextDate, setExpectedNextDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const detectedIndex = nextIndex === -1 ? null : detectStageIndex(location, steps, nextIndex);
  // Clamped to nextIndex so a stale manual pick can never point at a
  // stage that a previous submission (and the resulting refresh) has
  // already completed.
  const targetIndex = Math.max(overrideIndex ?? detectedIndex ?? nextIndex, nextIndex);
  const autoDetected = overrideIndex === null && detectedIndex !== null;

  function handleLocationChange(value: string) {
    setLocation(value);
    setOverrideIndex(null);
  }

  // Ocean leg isn't confirmed at Mombasa yet — nothing to mark manually
  // until Traqo (or a manual sync) confirms that first.
  if (!mombasaReached) {
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

  const stageName = steps[targetIndex];
  const isFinalStage = targetIndex === steps.length - 1;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!location.trim()) {
      setError("Enter the container's current location.");
      return;
    }
    if (!reason.trim()) {
      setError("Enter a reason or note for this update.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    // date is already ISO (from the date input) — compare it against
    // this stage's planned date the same way the automatic Traqo sync
    // does, so a late manual update gets flagged exactly like a late
    // carrier-confirmed one would.
    const actualIso = new Date(date).toISOString();
    const plannedIso = milestones[targetIndex].plannedDateIso;
    const delayResult = checkDelay(plannedIso, actualIso);
    const wasAlreadyDelayed = milestones[targetIndex].status === "delayed";

    const isNewDelay = delayResult.isDelayed && !wasAlreadyDelayed;
    const delayReason =
      isNewDelay && plannedIso
        ? buildDelayReason(stageName, plannedIso, actualIso, delayResult.daysLate)
        : undefined;

    const updated = milestones.map((m, i) => {
      if (i === targetIndex) {
        return {
          ...m,
          status: delayResult.isDelayed ? ("delayed" as const) : ("completed" as const),
          actualDate: shortDate(date),
          // Stored on this specific milestone (not a shared shipment-level
          // field) so a later delay at a different stage can't silently
          // overwrite this one's reason.
          ...(isNewDelay && delayReason
            ? { delayReason, delayReportedAt: shortDate(new Date().toISOString()) }
            : {}),
        };
      }
      // Anything skipped over between the last confirmed stage and this
      // one must have happened too — the container can't be at the store
      // without having passed through ICD — so it's backfilled as
      // completed rather than left stuck showing "Not reached" forever.
      if (i > nextIndex - 1 && i < targetIndex && m.status !== "completed") {
        return { ...m, status: "completed" as const, actualDate: m.actualDate ?? shortDate(date) };
      }
      if (i === targetIndex + 1 && m.status === "pending") {
        return { ...m, status: "current" as const };
      }
      return m;
    });

    const { error: updateError } = await supabase
      .from("shipments")
      .update({
        milestones: updated,
        current_status: stageName,
        current_location: location.trim(),
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

    const nextStageName = steps[targetIndex + 1];
    const hasExpectedNext = Boolean(nextStageName && expectedNextDate);

    // Every update notifies every role, not only ones that happen to be
    // a newly-detected delay — a routine location update still needs the
    // rest of the team to see it. `description` stays a clean, short,
    // auto-generated line; the manager's own explanation goes in
    // manager_note (the same structured, attributed field AlertCard
    // already renders as its own labeled box), instead of both being
    // mashed into one run-on sentence.
    await supabase.from("alerts").insert({
      severity: isNewDelay ? "warning" : "info",
      shipment_number: containerNumber,
      // Plain stage name, not "Delay at X" — the warning/info icon and
      // severity color already signal whether it's a delay; description
      // and manager_note carry the actual detail.
      title: stageName,
      description: isNewDelay && delayReason ? delayReason : `Now at: ${location.trim()}.`,
      acknowledged: false,
      manager_note: reason.trim(),
      manager_note_by: currentUserName ?? null,
      manager_note_at: new Date().toISOString(),
      ...(hasExpectedNext && {
        expected_next_stage: nextStageName,
        expected_next_date: expectedNextDate,
      }),
    });

    setSaving(false);
    setSuccess(true);
    setLocation("");
    setOverrideIndex(null);
    setReason("");
    setExpectedNextDate("");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-accent" />
        <h2 className="text-[14px] font-semibold text-text-primary">Inland progress</h2>
      </div>
      <p className="mt-1 text-[12px] text-text-secondary">
        Carrier tracking stops at Mombasa Port — tell us where the container
        actually is. Everyone on the team is notified when you send it.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div>
          <label className="text-[11px] text-text-tertiary">Current location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => handleLocationChange(e.target.value)}
            placeholder="e.g. On its way to ICD, or Arrived at the store in Ntinda"
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-[13px] focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[160px] flex-1">
            <label className="text-[11px] text-text-tertiary">
              Stage {autoDetected && location.trim() && "(detected — change if wrong)"}
            </label>
            <select
              value={targetIndex}
              onChange={(e) => setOverrideIndex(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border bg-page px-3 py-2 text-[13px] font-medium text-text-primary focus:border-accent focus:outline-none"
            >
              {steps.slice(nextIndex).map((name, i) => (
                <option key={name} value={nextIndex + i}>
                  {name}
                </option>
              ))}
            </select>
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
        </div>

        <div>
          <label className="text-[11px] text-text-tertiary">Reason / note</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. Cleared customs without issue, now heading inland"
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-[13px] focus:border-accent focus:outline-none"
          />
        </div>

        {steps[targetIndex + 1] && (
          <div>
            <label className="text-[11px] text-text-tertiary">
              Expected to reach &quot;{steps[targetIndex + 1]}&quot; by (optional)
            </label>
            <input
              type="date"
              value={expectedNextDate}
              onChange={(e) => setExpectedNextDate(e.target.value)}
              className="mt-1 rounded-lg border border-border px-3 py-2 text-[13px] focus:border-accent focus:outline-none"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {saving ? "Sending…" : "Send update"}
        </button>
      </form>

      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      {success && <p className="mt-2 text-[12px] text-success">Sent — everyone on the team is notified.</p>}
    </div>
  );
}
