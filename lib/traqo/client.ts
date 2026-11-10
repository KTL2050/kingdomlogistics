// Server-only client for traqocontainer.com's tracking API. Never import
// this from a client component — the Traqo keys must stay server-side.
import type { Country } from "@/types";

export interface TraqoEvent {
  idx: number;
  location: string;
  country: string;
  description: string;
  timestamp: string;
  event_type: string;
  event_code: string;
  transport_type: string;
  is_actual: 0 | 1;
  status: string;
  status_description: string;
}

export interface TraqoContainerData {
  reference_number: string;
  shipment_type: string;
  sealine: string;
  sealine_name: string;
  status: string;
  origin: string | null;
  destination: string | null;
  eta: string | null;
  total_days: number | null;
  remaining_days: number | null;
  is_active: boolean;
  is_delayed: boolean;
  closed_at: string | null;
  last_updated_at: string;
  latitude: number | null;
  longitude: number | null;
  events_table: TraqoEvent[];
}

export interface TraqoResponse {
  success: boolean;
  mode: "sandbox" | "live" | "stored";
  note?: string;
  data: TraqoContainerData;
}

export class TraqoError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "TraqoError";
    this.status = status;
  }
}

/**
 * Each country can have its own Traqo account. Kenya uses its own key
 * (TRAQO_API_KEY_KENYA) once it's set, and until then falls back to the
 * Uganda key — so Kenya containers use up the Uganda plan's shipment slots
 * until Kenya's own key is added. With no key at all, calls run against
 * Traqo's public sandbox instead (demo data, no key needed, same response
 * shape), as before.
 */
function keyFor(country: Country): string | undefined {
  if (country === "Kenya") return process.env.TRAQO_API_KEY_KENYA || process.env.TRAQO_API_KEY;
  return process.env.TRAQO_API_KEY;
}

async function traqoFetch(path: string, country: Country): Promise<TraqoResponse> {
  const key = keyFor(country);
  const base = key
    ? "https://traqocontainer.com/api/v1"
    : "https://traqocontainer.com/api/v1/sandbox";
  const res = await fetch(`${base}${path}`, {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
    cache: "no-store",
  });

  let json: TraqoResponse & { message?: string };
  try {
    json = await res.json();
  } catch {
    // 502/503/504 almost always mean the server (or something in front
    // of it) timed out or was overloaded and sent back an HTML error
    // page instead of real data — not a data problem on our end.
    const message =
      res.status === 502 || res.status === 503 || res.status === 504
        ? `The tracking service is temporarily unavailable (HTTP ${res.status}) — try again in a minute.`
        : `Traqo returned an unreadable response (HTTP ${res.status}).`;
    throw new TraqoError(message, res.status);
  }

  if (!res.ok || json.success === false) {
    const message =
      res.status === 404
        ? "The carrier has no record of this reference."
        : res.status === 400
        ? "That reference doesn't look valid."
        : res.status === 402
        ? "The tracking plan's shipment slots or quota are used up."
        : res.status === 429
        ? "Too many tracking requests right now — try again shortly."
        : res.status === 502
        ? "The carrier's system didn't respond — worth retrying."
        : json.message || `Tracking request failed (HTTP ${res.status}).`;
    throw new TraqoError(message, res.status);
  }

  return json;
}

/**
 * Tracks (or re-tracks) by container number. Per Traqo's docs this only
 * uses a shipment slot the *first* time a given reference is tracked —
 * calling it again to refresh status is safe and doesn't cost another
 * slot, so this same function covers both "start tracking" and
 * "refresh" for now.
 */
export function trackByContainer(containerNumber: string, country: Country): Promise<TraqoResponse> {
  return traqoFetch(`/container/${encodeURIComponent(containerNumber)}`, country);
}

export function trackByBillOfLading(blNumber: string, country: Country): Promise<TraqoResponse> {
  return traqoFetch(`/bl/${encodeURIComponent(blNumber)}`, country);
}