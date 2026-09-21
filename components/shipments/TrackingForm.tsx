"use client";

import { useState } from "react";
import { RefreshCw, Satellite } from "lucide-react";
import { syncTracking } from "@/app/shipments/[container]/actions";

export function TrackingForm({
  shipmentId,
  containerNumber,
  currentReference,
  currentReferenceType,
  lastSyncedAt,
}: {
  shipmentId: string;
  containerNumber: string;
  currentReference?: string | null;
  currentReferenceType?: "container" | "bl" | null;
  lastSyncedAt?: string | null;
}) {
  const [reference, setReference] = useState(currentReference ?? "");
  const [referenceType, setReferenceType] = useState<"container" | "bl">(
    currentReferenceType ?? "container"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reference.trim()) {
      setError("Enter a container number or bill of lading number.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);

    const result = await syncTracking({
      shipmentId,
      containerNumber,
      reference: reference.trim(),
      referenceType,
    });

    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setSuccess(true);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Satellite className="h-4 w-4 text-accent" />
        <h2 className="text-[14px] font-semibold text-text-primary">Carrier tracking</h2>
      </div>
      <p className="mt-1 text-[12px] text-text-secondary">
        Fetches real status from the shipping line for the ocean leg only
        (up to arrival at Mombasa Port). Everything after that stays a
        manual update, same as before.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <label className="text-[11px] text-text-tertiary">Container or B/L number</label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. PCIU9387354"
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-[13px] focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[11px] text-text-tertiary">Type</label>
          <select
            value={referenceType}
            onChange={(e) => setReferenceType(e.target.value as "container" | "bl")}
            className="mt-1 rounded-lg border border-border px-2 py-2 text-[13px] focus:border-accent focus:outline-none"
          >
            <option value="container">Container #</option>
            <option value="bl">Bill of Lading</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {currentReference ? "Refresh status" : "Start tracking"}
        </button>
      </form>

      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      {success && <p className="mt-2 text-[12px] text-success">Updated from the carrier.</p>}
      {lastSyncedAt && !success && (
        <p className="mt-2 text-[11px] text-text-tertiary">
          Last synced: {new Date(lastSyncedAt).toLocaleString("en-GB")}
        </p>
      )}
    </div>
  );
}