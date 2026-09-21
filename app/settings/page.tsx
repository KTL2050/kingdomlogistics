import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { TeamPanel } from "@/components/settings/TeamPanel";
import { StageDurationsPanel } from "@/components/settings/StageDurationsPanel";
import { getCurrentUser } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { canManageStageDurations } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = user.role === "Admin" && user.status === "approved";
  const canManageDurations = user.status === "approved" && canManageStageDurations(user.role);

  return (
    <AppShell
      breadcrumb="Logistics / Settings"
      title="Settings"
      subtitle="Your profile, role, and backend connection"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProfileForm userId={user.id} initialFullName={user.fullName} role={user.role} />

        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-[15px] font-semibold text-text-primary">Backend connection</h2>
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-border p-4">
            {isSupabaseConfigured ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            )}
            <div className="text-sm">
              <div className="font-medium text-text-primary">
                {isSupabaseConfigured ? "Connected to Supabase" : "Running on sample data"}
              </div>
              <p className="mt-1 text-text-secondary">
                {isSupabaseConfigured
                  ? "Shipments, containers, milestones, and alerts are being read from your live Supabase project."
                  : "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then run lib/supabase/schema.sql in your Supabase project's SQL editor to switch to live data."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {canManageDurations && (
        <div className="mt-4">
          <StageDurationsPanel />
        </div>
      )}

      {isAdmin && (
        <div className="mt-4">
          <TeamPanel currentUserId={user.id} />
        </div>
      )}
    </AppShell>
  );
}