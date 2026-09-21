"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, Check, Info, MessageSquarePlus } from "lucide-react";
import type { Alert } from "@/types";
import { cn, severityStyles } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";

const SEVERITY_ICON = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export function AlertCard({
  alert,
  canAddNote = false,
  currentUserName,
}: {
  alert: Alert;
  /** Only Admin/Logistics Manager/Operations Officer may add or edit the
   * justification note — everyone who can see the alert can read it. */
  canAddNote?: boolean;
  currentUserName?: string;
}) {
  const router = useRouter();
  const [acknowledging, setAcknowledging] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(alert.managerNote ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const style = severityStyles[alert.severity];
  const Icon = SEVERITY_ICON[alert.severity];

  async function handleAcknowledge() {
    if (!supabase) return;
    setAcknowledging(true);
    await supabase.from("alerts").update({ acknowledged: true }).eq("id", alert.id);
    router.refresh();
  }

  async function handleSaveNote() {
    if (!supabase) return;
    setSavingNote(true);
    const { error } = await supabase
      .from("alerts")
      .update({
        manager_note: noteDraft.trim() || null,
        manager_note_by: noteDraft.trim() ? currentUserName ?? null : null,
        manager_note_at: noteDraft.trim() ? new Date().toISOString() : null,
      })
      .eq("id", alert.id);
    setSavingNote(false);
    if (error) return;
    setEditingNote(false);
    router.refresh();
  }

  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
      <div
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          style.bg
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", style.text)} />
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/shipments/${alert.shipmentNumber}`} className="block hover:opacity-80">
          <div className="text-[12.5px] font-medium text-text-primary">{alert.title}</div>
          <div className="mt-0.5 text-xs text-text-secondary">{alert.description}</div>
        </Link>

        {alert.managerNote && !editingNote && (
          <div className="mt-2 rounded-md border border-info/20 bg-info-soft px-2.5 py-2">
            <p className="text-[11.5px] text-text-primary">{alert.managerNote}</p>
            <p className="mt-1 text-[10.5px] text-text-tertiary">
              — {alert.managerNoteBy ?? "Unknown"}
              {alert.managerNoteAt ? `, ${alert.managerNoteAt}` : ""}
            </p>
          </div>
        )}

        {editingNote && (
          <div className="mt-2 space-y-1.5">
            <textarea
              autoFocus
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={2}
              placeholder="Explain the reason for this delay…"
              className="w-full rounded-md border border-border px-2.5 py-1.5 text-[11.5px] focus:border-accent focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveNote}
                disabled={savingNote}
                className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              >
                {savingNote ? "Saving…" : "Save note"}
              </button>
              <button
                onClick={() => {
                  setNoteDraft(alert.managerNote ?? "");
                  setEditingNote(false);
                }}
                className="text-[11px] font-medium text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] text-text-tertiary">{alert.timestamp}</span>
          <div className="flex shrink-0 items-center gap-2">
            {canAddNote && !editingNote && (
              <button
                onClick={() => setEditingNote(true)}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-text-secondary hover:bg-page"
              >
                <MessageSquarePlus className="h-3 w-3" />
                {alert.managerNote ? "Edit note" : "Add note"}
              </button>
            )}
            <button
              onClick={handleAcknowledge}
              disabled={acknowledging}
              className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-text-secondary hover:bg-page disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              {acknowledging ? "…" : "Acknowledge"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}