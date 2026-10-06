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
  // Common Chinese loading ports (approximate port-area coordinates), so a
  // container that doesn't load at Shekou gets drawn from where it really
  // started instead of from Shekou.
  xiamen: { lat: 24.4798, lng: 118.0894 },
  yantian: { lat: 22.5667, lng: 114.2833 },
  shenzhen: { lat: 22.5431, lng: 114.0579 },
  "hong kong": { lat: 22.3193, lng: 114.1694 },
  nansha: { lat: 22.7, lng: 113.6 },
  guangzhou: { lat: 23.1291, lng: 113.2644 },
  shantou: { lat: 23.35, lng: 116.68 },
  fuzhou: { lat: 25.97, lng: 119.4 },
  shanghai: { lat: 31.2304, lng: 121.4737 },
  ningbo: { lat: 29.8683, lng: 121.544 },
  qingdao: { lat: 36.0671, lng: 120.3826 },
  tianjin: { lat: 38.986, lng: 117.7 },
};

export function findKnownPort(locationName: string | null | undefined): { lat: number; lng: number } | null {
  if (!locationName) return null;
  const name = locationName.trim().toLowerCase();
  // Carriers often send "XIAMEN, CN (XMN)" rather than a bare "Xiamen".
  return KNOWN_PORTS[name] ?? KNOWN_PORTS[name.split(/[,(]/)[0].trim()] ?? null;
}