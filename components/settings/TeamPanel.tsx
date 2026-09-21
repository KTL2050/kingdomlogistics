"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { UserRole, UserStatus } from "@/types";

const ROLES: UserRole[] = ["Admin", "Logistics Manager", "Operations Officer", "Viewer"];

interface TeamMember {
  id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  status: UserStatus;
}

const STATUS_STYLES: Record<UserStatus, string> = {
  pending: "bg-warning-soft text-warning",
  approved: "bg-success-soft text-success",
  rejected: "bg-danger-soft text-danger",
};

export function TeamPanel({ currentUserId }: { currentUserId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select("id, full_name, email, role, status")
      .order("status", { ascending: true })
      .order("full_name", { ascending: true });
    setMembers((data as TeamMember[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateMember(id: string, changes: Partial<Pick<TeamMember, "role" | "status">>) {
    if (!supabase) return;
    setSavingId(id);
    await supabase.from("users").update(changes).eq("id", id);
    await load();
    setSavingId(null);
  }

  const pending = members.filter((m) => m.status === "pending");
  const others = members.filter((m) => m.status !== "pending");

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-[15px] font-semibold text-text-primary">Team members</h2>
      <p className="mt-1 text-[12.5px] text-text-secondary">
        Approve new signups and assign their role. Only Admins can see this panel.
      </p>

      {loading ? (
        <p className="mt-4 text-[13px] text-text-tertiary">Loading…</p>
      ) : (
        <div className="mt-4 space-y-5">
          {pending.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                Awaiting approval ({pending.length})
              </div>
              <div className="space-y-2">
                {pending.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-text-primary">
                        {m.full_name}
                      </div>
                      <div className="truncate text-[11.5px] text-text-tertiary">{m.email}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <select
                        defaultValue={m.role}
                        onChange={(e) =>
                          updateMember(m.id, { role: e.target.value as UserRole })
                        }
                        disabled={savingId === m.id}
                        className="rounded-md border border-border px-2 py-1 text-[12.5px]"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => updateMember(m.id, { status: "approved" })}
                        disabled={savingId === m.id}
                        className="flex items-center gap-1 rounded-md bg-success px-2.5 py-1 text-[12.5px] font-medium text-white hover:bg-success/90 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => updateMember(m.id, { status: "rejected" })}
                        disabled={savingId === m.id}
                        className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[12.5px] font-medium text-text-secondary hover:bg-page disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
              Everyone else ({others.length})
            </div>
            <div className="space-y-2">
              {others.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-text-primary">
                      {m.full_name} {m.id === currentUserId && "(you)"}
                    </div>
                    <div className="truncate text-[11.5px] text-text-tertiary">{m.email}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[m.status]}`}
                    >
                      {m.status}
                    </span>
                    <select
                      defaultValue={m.role}
                      onChange={(e) => updateMember(m.id, { role: e.target.value as UserRole })}
                      disabled={savingId === m.id || m.id === currentUserId}
                      className="rounded-md border border-border px-2 py-1 text-[12.5px] disabled:opacity-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}