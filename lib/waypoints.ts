import type { TraqoEvent } from "@/lib/traqo/client";
import { findKnownPort } from "@/lib/ports";

export interface Waypoint {
  name: string;
  lat: number;
  lng: number;
  date: string;
  description: string;
}

type Coords = { lat: number; lng: number };

// Looked-up places stay cached for the life of the server process, so a
// busy route (e.g. Singapore) is only ever geocoded once, not per sync.
const geocodeCache = new Map<string, Coords | null>();

/**
 * Traqo gives a stop's NAME (and country) but never its coordinates, so
 * anything not in the built-in port list is looked up by name on
 * OpenStreetMap's free Nominatim service. That's what lets a container
 * loaded at any port, anywhere, get drawn from where it really started
 * without someone adding the port by hand. Returns null if nothing
 * matches — that stop then just gets no map marker, as before.
 */
async function geocodeLocation(event: TraqoEvent): Promise<Coords | null> {
  // "XIAMEN, CN (XMN)" -> "XIAMEN"
  const place = event.location.split(/[,(]/)[0].trim();
  const query = [place, event.country].filter(Boolean).join(", ");
  const key = query.toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  let result: Coords | null = null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
      {
        // Nominatim's usage policy requires an identifying User-Agent.
        headers: { "User-Agent": "KingdomTradingTracker/1.0 (container tracking)" },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (res.ok) {
      const rows = (await res.json()) as { lat: string; lon: string }[];
      const lat = Number(rows[0]?.lat);
      const lng = Number(rows[0]?.lon);
      if (rows[0] && Number.isFinite(lat) && Number.isFinite(lng)) result = { lat, lng };
    }
  } catch {
    // Network hiccup or timeout — don't cache it, so the next sync retries.
    return null;
  }

  geocodeCache.set(key, result);
  return result;
}

/**
 * Reduces Traqo's raw event list down to one marker per distinct,
 * real (already-happened) location that we have coordinates for, in
 * the order the container actually passed through them. If a location
 * fired more than one event (e.g. loaded, then departed, both at the
 * same port), the most recent one's description is what's shown.
 */
export async function buildWaypoints(events: TraqoEvent[]): Promise<Waypoint[]> {
  const actualEvents = events.filter((e) => e.is_actual === 1);

  const byLocation = new Map<string, TraqoEvent>();
  for (const event of actualEvents) {
    if (!event.location) continue;
    const existing = byLocation.get(event.location);
    if (!existing || new Date(event.timestamp) > new Date(existing.timestamp)) {
      byLocation.set(event.location, event);
    }
  }

  const ordered = Array.from(byLocation.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const waypoints: Waypoint[] = [];
  for (const event of ordered) {
    const coords = findKnownPort(event.location) ?? (await geocodeLocation(event));
    if (!coords) continue;
    waypoints.push({
      name: event.location,
      lat: coords.lat,
      lng: coords.lng,
      date: new Date(event.timestamp).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      description: event.description,
    });
  }
  return waypoints;
}
