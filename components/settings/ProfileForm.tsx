"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { UserRole } from "@/types";

export function ProfileForm({
  userId,
  initialFullName,
  role,
}: {
  userId: string;
  initialFullName: string;
  role: UserRole;
}) {
  const [fullName, setFullName] = useState(initialFullName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setSaved(false);
    setError(null);

    const { error } = await supabase
      .from("users")
      .update({ full_name: fullName })
      .eq("id", userId);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-[15px] font-semibold text-text-primary">Profile</h2>
      <form onSubmit={handleSave} className="mt-4 space-y-4">
        <div>
          <label className="text-xs text-text-tertiary">Full name</label>
          <input
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setSaved(false);
            }}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-text-tertiary">Role</label>
          <div className="mt-1 rounded-lg border border-border bg-page px-3 py-2 text-sm text-text-secondary">
            {role}
          </div>
          <p className="mt-1 text-[11px] text-text-tertiary">
            Roles are assigned by an Admin, not edited here.
          </p>
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
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
      </form>
    </div>
  );
}