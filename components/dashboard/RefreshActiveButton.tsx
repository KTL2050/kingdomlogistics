"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { refreshActiveTracking } from "@/app/shipments/[container]/actions";

export function RefreshActiveButton() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setSummary(null);
    const result = await refreshActiveTracking();
    setLoading(false);
    if (result.attempted === 0) {
      setSummary("No active containers with tracking set up.");
    } else if (result.failed === 0) {
      setSummary(`Refreshed ${result.refreshed} of ${result.attempted}.`);
    } else {
      setSummary(`Refreshed ${result.refreshed} of ${result.attempted} — ${result.failed} failed.`);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-text-secondary hover:bg-page disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        Refresh status
      </button>
      {summary && <span className="text-[12px] text-text-tertiary">{summary}</span>}
    </div>
  );
}
