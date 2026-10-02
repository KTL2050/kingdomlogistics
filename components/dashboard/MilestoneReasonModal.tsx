"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { Milestone } from "@/types";

function shortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/**
 * Lets a manager add or correct the reason for any stage — including one
 * that's already in the past, like Mombasa Port — not just whichever
 * stage is "next" in the inland-progress flow. Each milestone keeps its
 * own reason, so this never overwrites a different stage's explanation.
 */
export function MilestoneReasonModal({
  shipmentId,
  containerNumber,
  milestones,
  milestone,
  currentUserName,
  onClose,
}: {
  shipmentId: string;
  containerNumber: string;
  milestones: Milestone[];
  milestone: Milestone;
  currentUserName?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState(milestone.delayReason ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!supabase) return;
    if (!reason.trim()) {
      setError("Enter a reason.");
      return;
    }
    setSaving(true);
    setError(null);

    const reportedAt = shortDate(new Date().toISOString());
    const updated = milestones.map((m) =>
      m.id === milestone.id ? { ...m, delayReason: reason.trim(), delayReportedAt: reportedAt } : m
    );

    const { error: updateError } = await supabase
      .from("shipments")
      .update({ milestones: updated })
      .eq("id", shipmentId);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    // Same "everyone gets notified" promise as sending a regular inland
    // progress update — a retroactive reason is still news to the team.
    const { error: alertError } = await supabase.from("alerts").insert({
      severity: "warning",
      shipment_number: containerNumber,
      title: milestone.name,
      description: `Reason recorded for ${milestone.name}.`,
      acknowledged: false,
      manager_note: reason.trim(),
      manager_note_by: currentUserName ?? null,
      manager_note_at: new Date().toISOString(),
    });

    setSaving(false);
    // The reason itself already saved successfully — if only the
    // notification failed, that must still surface rather than silently
    // closing as if everyone was told.
    if (alertError) {
      setError(`Reason saved, but the team notification failed: ${alertError.message}`);
      router.refresh();
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/30 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-text-primary">
            Reason for {milestone.name}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-page"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-[12.5px] text-text-secondary">
          Planned {milestone.plannedDate} — actual {milestone.actualDate ?? "not reached"}.
        </p>

        <textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Explain what actually happened at this stage…"
          className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-[13px] focus:border-accent focus:outline-none"
        />

        {error && <p className="mt-2 text-xs text-danger">{error}</p>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-text-secondary hover:bg-page"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save reason"}
          </button>
        </div>
      </div>
    </div>
  );
}
