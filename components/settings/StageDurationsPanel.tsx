"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { ROUTE_STEPS_ICD } from "@/lib/mock-data";

interface StageDuration {
  id: string;
  step_name: string;
  expected_days: number;
}

export function StageDurationsPanel() {
  const [rows, setRows] = useState<StageDuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!supabase) return;
      setLoading(true);
      const { data } = await supabase.from("stage_durations").select("*");
      const byName = new Map((data ?? []).map((r) => [r.step_name, r as StageDuration]));

      // Always show every step from the full (Uncle Bills / ICD) route,
      // in route order — Aiwibi Uganda's route is a subset of the same
      // step names, so one ordered list covers both.
      const ordered = ROUTE_STEPS_ICD.map(
        (name) =>
          byName.get(name) ?? {
            id: name,
            step_name: name,
            expected_days: 1,
          }
      );
      setRows(ordered);
      setLoading(false);
    }
    load();
  }, []);

  function updateDays(stepName: string, days: number) {
    setSaved(false);
    setRows((prev) =>
      prev.map((r) => (r.step_name === stepName ? { ...r, expected_days: days } : r))
    );
  }

  async function handleSave() {
    if (!supabase) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const { error } = await supabase.from("stage_durations").upsert(
      rows.map((r) => ({ step_name: r.step_name, expected_days: r.expected_days })),
      { onConflict: "step_name" }
    );

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-[15px] font-semibold text-text-primary">Default stage durations</h2>
      <p className="mt-1 text-[12.5px] text-text-secondary">
        How many days a container is expected to spend at each stage by
        default. &quot;At ICD&quot; only applies to Uncle Bills containers —
        Aiwibi Uganda skips that step entirely. Any individual container
        can override these from its own detail page, so this is a
        fallback, not a fixed rule.
      </p>

      {loading ? (
        <p className="mt-4 text-[13px] text-text-tertiary">Loading…</p>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {rows.map((r) => (
              <div
                key={r.step_name}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <span className="text-[13px] text-text-primary">{r.step_name}</span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={r.expected_days}
                    onChange={(e) => updateDays(r.step_name, Number(e.target.value))}
                    className="w-16 rounded-md border border-border px-2 py-1 text-right text-[12.5px] focus:border-accent focus:outline-none"
                  />
                  <span className="text-[12px] text-text-tertiary">days</span>
                </div>
              </div>
            ))}
          </div>

          {error && <p className="mt-3 text-xs text-danger">{error}</p>}

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !supabase}
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