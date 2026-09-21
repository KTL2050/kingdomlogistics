"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { computePlannedDates } from "@/lib/planning";
import type { Milestone } from "@/types";

interface Row {
  stepName: string;
  defaultDays: number;
  overrideDays: number | null; // null = no override, use the default
}

export function ContainerStageDurationsPanel({
  shipmentId,
  containerNumber,
  steps,
  etd,
  milestones,
}: {
  shipmentId: string;
  containerNumber: string;
  steps: readonly string[];
  etd: string;
  milestones: Milestone[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!supabase) return;
      setLoading(true);
      const [{ data: defaults }, { data: overrides }] = await Promise.all([
        supabase.from("stage_durations").select("*"),
        supabase
          .from("container_stage_durations")
          .select("*")
          .eq("container_number", containerNumber),
      ]);

      const defaultByStep = new Map(
        (defaults ?? []).map((d) => [d.step_name as string, d.expected_days as number])
      );
      const overrideByStep = new Map(
        (overrides ?? []).map((d) => [d.step_name as string, d.expected_days as number])
      );

      setRows(
        steps.map((step) => ({
          stepName: step,
          defaultDays: defaultByStep.get(step) ?? 1,
          overrideDays: overrideByStep.get(step) ?? null,
        }))
      );
      setLoading(false);
    }
    load();
  }, [containerNumber, steps]);

  function updateOverride(stepName: string, value: string) {
    setSaved(false);
    setRows((prev) =>
      prev.map((r) =>
        r.stepName === stepName
          ? { ...r, overrideDays: value === "" ? null : Math.max(0, Number(value)) }
          : r
      )
    );
  }

  async function handleSave() {
    if (!supabase) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const toUpsert = rows.filter((r) => r.overrideDays !== null);
    const toClear = rows.filter((r) => r.overrideDays === null);

    if (toUpsert.length > 0) {
      const { error: upsertError } = await supabase.from("container_stage_durations").upsert(
        toUpsert.map((r) => ({
          container_number: containerNumber,
          step_name: r.stepName,
          expected_days: r.overrideDays,
        })),
        { onConflict: "container_number,step_name" }
      );
      if (upsertError) {
        setSaving(false);
        setError(upsertError.message);
        return;
      }
    }

    if (toClear.length > 0) {
      const { error: deleteError } = await supabase
        .from("container_stage_durations")
        .delete()
        .eq("container_number", containerNumber)
        .in(
          "step_name",
          toClear.map((r) => r.stepName)
        );
      if (deleteError) {
        setSaving(false);
        setError(deleteError.message);
        return;
      }
    }

    // Recompute this container's own Planned dates immediately, so the
    // timeline below reflects the new durations without waiting for the
    // next tracking sync.
    const merged: Record<string, number> = {};
    for (const r of rows) merged[r.stepName] = r.overrideDays ?? r.defaultDays;
    const plannedDates = computePlannedDates(steps, etd, merged);
    const updatedMilestones = milestones.map((m, i) => ({
      ...m,
      plannedDate: plannedDates[i]?.plannedDate ?? m.plannedDate,
      plannedDateIso: plannedDates[i]?.plannedDateIso ?? m.plannedDateIso,
      durationLabel: plannedDates[i]?.durationLabel ?? m.durationLabel,
    }));

    const { error: shipmentError } = await supabase
      .from("shipments")
      .update({ milestones: updatedMilestones })
      .eq("id", shipmentId);

    setSaving(false);
    if (shipmentError) {
      setError(shipmentError.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  if (!supabase) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-[15px] font-semibold text-text-primary">
        Stage durations for {containerNumber}
      </h2>
      <p className="mt-1 text-[12.5px] text-text-secondary">
        Overrides the default days for this container only — other
        containers are unaffected. Leave a field blank to fall back to the
        default shown as its placeholder.
      </p>

      {loading ? (
        <p className="mt-4 text-[13px] text-text-tertiary">Loading…</p>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {rows.map((r) => (
              <div
                key={r.stepName}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <span className="text-[13px] text-text-primary">{r.stepName}</span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    placeholder={String(r.defaultDays)}
                    value={r.overrideDays ?? ""}
                    onChange={(e) => updateOverride(r.stepName, e.target.value)}
                    className="w-16 rounded-md border border-border px-2 py-1 text-right text-[12.5px] focus:border-accent focus:outline-none"
                  />
                  <span className="text-[12px] text-text-tertiary">days</span>
                  {r.overrideDays !== null && (
                    <button
                      type="button"
                      onClick={() => updateOverride(r.stepName, "")}
                      title="Reset to default"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary hover:bg-page"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="mt-3 text-xs text-danger">{error}</p>}

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-[12.5px] text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
