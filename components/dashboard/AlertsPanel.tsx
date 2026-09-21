import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { AlertCard } from "@/components/dashboard/AlertCard";
import type { Alert } from "@/types";

export function AlertsPanel({
  alerts,
  canAddNote = false,
  currentUserName,
}: {
  alerts: Alert[];
  canAddNote?: boolean;
  currentUserName?: string;
}) {
  const visible = alerts.slice(0, 3);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[13.5px] font-semibold text-text-primary">
          Exceptions &amp; alerts
        </h2>
        <Link
          href="/alerts"
          className="text-[12.5px] font-medium text-accent hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="flex-1">
        {visible.map((a) => (
          <AlertCard key={a.id} alert={a} canAddNote={canAddNote} currentUserName={currentUserName} />
        ))}
      </div>

      <div className="border-t border-border px-4 py-2.5">
        <Link
          href="/alerts"
          className="flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Manage alerts
        </Link>
      </div>
    </div>
  );
}
