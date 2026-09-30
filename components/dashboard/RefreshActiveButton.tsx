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
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-text-secondary hover:bg-page hover:text-text-primary disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        Refresh status
      </button>
      {summary && <p className="px-3 pb-1.5 text-[11px] text-text-tertiary">{summary}</p>}
    </div>
  );
}
