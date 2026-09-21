/**
 * Traqo's event data tells us a stop's name (e.g. "Singapore") but never
 * its coordinates — only the live vessel position comes with lat/lng.
 * This is a small, deliberately growable lookup for the ports we've
 * actually seen come through tracking. A stop whose name isn't listed
 * here simply won't get a map marker — it still shows up correctly
 * everywhere else (milestones, alerts, etc.), just not pinned on the map.
 */
export const KNOWN_PORTS: Record<string, { lat: number; lng: number }> = {
  shekou: { lat: 22.4874, lng: 113.8967 },
  singapore: { lat: 1.29027, lng: 103.851959 },
  mombasa: { lat: -4.0435, lng: 39.6682 },
};

export function findKnownPort(locationName: string | null | undefined): { lat: number; lng: number } | null {
  if (!locationName) return null;
  return KNOWN_PORTS[locationName.trim().toLowerCase()] ?? null;
}