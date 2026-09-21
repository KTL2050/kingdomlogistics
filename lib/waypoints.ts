import type { TraqoEvent } from "@/lib/traqo/client";
import { findKnownPort } from "@/lib/ports";

export interface Waypoint {
  name: string;
  lat: number;
  lng: number;
  date: string;
  description: string;
}

/**
 * Reduces Traqo's raw event list down to one marker per distinct,
 * real (already-happened) location that we have coordinates for, in
 * the order the container actually passed through them. If a location
 * fired more than one event (e.g. loaded, then departed, both at the
 * same port), the most recent one's description is what's shown.
 */
export function buildWaypoints(events: TraqoEvent[]): Waypoint[] {
  const actualEvents = events.filter((e) => e.is_actual === 1);

  const byLocation = new Map<string, TraqoEvent>();
  for (const event of actualEvents) {
    if (!event.location) continue;
    const existing = byLocation.get(event.location);
    if (!existing || new Date(event.timestamp) > new Date(existing.timestamp)) {
      byLocation.set(event.location, event);
    }
  }

  return Array.from(byLocation.values())
    .filter((event) => findKnownPort(event.location) !== null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((event) => {
      const coords = findKnownPort(event.location)!;
      return {
        name: event.location,
        lat: coords.lat,
        lng: coords.lng,
        date: new Date(event.timestamp).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        description: event.description,
      };
    });
}