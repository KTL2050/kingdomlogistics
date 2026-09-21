import { AppShell } from "@/components/layout/AppShell";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { getAlerts, getCurrentUser } from "@/lib/data";
import { canManageStageDurations } from "@/lib/utils";

export default async function AlertsPage() {
  const [allAlerts, user] = await Promise.all([getAlerts(), getCurrentUser()]);
  const canAddNote = Boolean(user && canManageStageDurations(user.role));
  // Acknowledged alerts are resolved — this page is specifically for
  // what still needs a decision, matching its own subtitle.
  const alerts = allAlerts.filter((a) => !a.acknowledged);
  const critical = alerts.filter((a) => a.severity === "critical");
  const warning = alerts.filter((a) => a.severity === "warning");
  const info = alerts.filter((a) => a.severity === "info");

  return (
    <AppShell
      breadcrumb="Logistics / Alerts"
      title="Exceptions & Alerts"
      subtitle="Everything that needs a decision or a look"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-[15px] font-semibold text-text-primary">
              Critical <span className="text-text-tertiary">({critical.length})</span>
            </h2>
          </div>
          {critical.length === 0 ? (
            <div className="px-5 py-8 text-center text-[12.5px] text-text-tertiary">
              Nothing critical right now.
            </div>
          ) : (
            critical.map((a) => (
              <AlertCard key={a.id} alert={a} canAddNote={canAddNote} currentUserName={user?.fullName} />
            ))
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-[15px] font-semibold text-text-primary">
              Warnings <span className="text-text-tertiary">({warning.length})</span>
            </h2>
          </div>
          {warning.length === 0 ? (
            <div className="px-5 py-8 text-center text-[12.5px] text-text-tertiary">
              No warnings right now.
            </div>
          ) : (
            warning.map((a) => (
              <AlertCard key={a.id} alert={a} canAddNote={canAddNote} currentUserName={user?.fullName} />
            ))
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-[15px] font-semibold text-text-primary">
              Info <span className="text-text-tertiary">({info.length})</span>
            </h2>
          </div>
          {info.length === 0 ? (
            <div className="px-5 py-8 text-center text-[12.5px] text-text-tertiary">
              Nothing to note right now.
            </div>
          ) : (
            info.map((a) => (
              <AlertCard key={a.id} alert={a} canAddNote={canAddNote} currentUserName={user?.fullName} />
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}