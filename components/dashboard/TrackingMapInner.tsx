"use client";

import { Fragment, useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { Locate, Minus, Plus } from "lucide-react";
import type { Shipment } from "@/types";

// Fixed reference points for the trunk route. Store and ICD coordinates
// are the exact ones pulled from the real Google Maps locations (Ntinda
// Industrial, Kampala / Multiple ICD) rather than rough estimates.
const ORIGIN = { lat: 22.4874, lng: 113.8967, label: "Shekou, China" };
const MOMBASA_PORT = { lat: -4.0435, lng: 39.6682, label: "Mombasa Port" };
const KAMPALA_ICD = { lat: 0.3377893, lng: 32.6167942, label: "Multiple ICD" };
const STORE = { lat: 0.3396837, lng: 32.623353, label: "Store — Ntinda Industrial, Kampala" };

type LatLng = { lat: number; lng: number };

/**
 * Splits one shipment's full route into the part already traveled
 * (solid line) and the part still ahead (dotted line). The solid line
 * now runs through every real, named stop Traqo has confirmed the
 * container actually passed (shipment.waypoints) — e.g. a
 * transshipment port — in the order it passed them, rather than a
 * generic curve approximation. Once past Mombasa, milestone statuses
 * are the only signal available (Traqo has no visibility there, and
 * the inland leg has no equivalent waypoint data).
 */
function buildRouteSegments(shipment: Shipment): {
  traveled: [number, number][];
  remaining: [number, number][];
} {
  const milestoneStatus = (name: string) =>
    shipment.milestones.find((m) => m.name === name)?.status;

  const mombasaDone = milestoneStatus("Mombasa Port") === "completed";
  const icdDone = milestoneStatus("At ICD") === "completed";
  const storeDone = milestoneStatus("Arrived at Store") === "completed";

  const toPairs = (points: LatLng[]) => points.map((p) => [p.lat, p.lng] as [number, number]);
  const waypointPoints: LatLng[] = (shipment.waypoints ?? []).map((w) => ({ lat: w.lat, lng: w.lng }));

  if (!mombasaDone) {
    const pos = { lat: shipment.position.lat, lng: shipment.position.lng };
    return {
      traveled: toPairs([ORIGIN, ...waypointPoints, pos]),
      remaining: toPairs([pos, MOMBASA_PORT, KAMPALA_ICD, STORE]),
    };
  }

  // Ocean leg is fully done — the solid line covers origin through every
  // real waypoint to Mombasa, and how far it continues inland depends
  // on manually-updated milestones.
  const traveled: LatLng[] = [ORIGIN, ...waypointPoints, MOMBASA_PORT];
  const remaining: LatLng[] = [];

  if (!icdDone) {
    remaining.push(MOMBASA_PORT, KAMPALA_ICD, STORE);
  } else {
    traveled.push(KAMPALA_ICD);
    if (!storeDone) {
      remaining.push(KAMPALA_ICD, STORE);
    } else {
      traveled.push(STORE);
    }
  }

  return { traveled: toPairs(traveled), remaining: toPairs(remaining) };
}

function pinIcon(kind: "ship" | "anchor" | "truck" | "store", color: string) {
  const glyphs: Record<string, string> = {
    ship: '<path d="M3 17h18l-1.5 3.5a2 2 0 0 1-1.8 1.2H6.3a2 2 0 0 1-1.8-1.2L3 17Z"/><path d="M5 17V9l7-4 7 4v8"/><path d="M9 17V9M15 17V9"/>',
    anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v13M5 12H2a10 10 0 0 0 10 10 10 10 0 0 0 10-10h-3M5 12a7 7 0 0 0 14 0"/>',
    truck: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/>',
    store: '<path d="M4 10v10h16V10"/><path d="M2 10l2-6h16l2 6"/><path d="M9 20v-6h6v6"/>',
  };
  return L.divIcon({
    className: "",
    html: `<div style="
        width:34px;height:34px;border-radius:9999px;background:${color};
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 6px rgba(15,23,42,0.35);border:2px solid white;">
        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24"
          fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${glyphs[kind]}
        </svg>
      </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
}

// Small marker for a real, confirmed stop along the way (e.g. a
// transshipment port) — distinct from the main fixed route markers and
// the moving current-position dot.
function waypointIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
        width:22px;height:22px;border-radius:9999px;background:#f59e0b;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 4px rgba(15,23,42,0.35);border:2px solid white;">
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
          fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="5" r="2"/><path d="M12 7v13M5 12H2a10 10 0 0 0 10 10 10 10 0 0 0 10-10h-3M5 12a7 7 0 0 0 14 0"/>
        </svg>
      </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });
}

function dotIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:11px;height:11px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(15,23,42,0.4);"></div>`,
    iconSize: [11, 11],
    iconAnchor: [5, 5],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(points, { padding: [32, 32] });
  }, [map, points]);
  return null;
}

function ZoomControls() {
  const map = useMap();
  return (
    <div className="absolute bottom-24 right-4 z-[1000] flex flex-col overflow-hidden rounded-lg border border-border-strong bg-surface shadow-sm">
      <button
        aria-label="Zoom in"
        onClick={() => map.zoomIn()}
        className="flex h-9 w-9 items-center justify-center border-b border-border-strong text-text-secondary hover:bg-page"
      >
        <Plus className="h-4 w-4" />
      </button>
      <button
        aria-label="Zoom out"
        onClick={() => map.zoomOut()}
        className="flex h-9 w-9 items-center justify-center text-text-secondary hover:bg-page"
      >
        <Minus className="h-4 w-4" />
      </button>
    </div>
  );
}

function RecenterControl({ points }: { points: [number, number][] }) {
  const map = useMap();
  return (
    <button
      aria-label="Recenter map"
      onClick={() => map.fitBounds(points, { padding: [32, 32] })}
      className="absolute bottom-14 right-4 z-[1000] flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong bg-surface text-text-secondary shadow-sm hover:bg-page"
    >
      <Locate className="h-4 w-4" />
    </button>
  );
}

export default function TrackingMapInner({
  shipments,
}: {
  shipments: Shipment[];
}) {
  const trunkPoints: [number, number][] = useMemo(
    () => [
      [ORIGIN.lat, ORIGIN.lng],
      [MOMBASA_PORT.lat, MOMBASA_PORT.lng],
      [KAMPALA_ICD.lat, KAMPALA_ICD.lng],
      [STORE.lat, STORE.lng],
    ],
    []
  );

  const dotColor: Record<string, string> = {
    on_time: "#17864f",
    delayed: "#d0361c",
    not_started: "#b6650a",
    completed: "#17864f",
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute left-4 top-4 z-[1000] flex items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-[13px] font-medium text-text-primary shadow-sm">
        <span className="h-2 w-2 rounded-full bg-success" />
        Live tracking
      </div>

      <MapContainer
        center={[15, 55]}
        zoom={3}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={true}
        className="h-full w-full"
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
        />

        {shipments.map((s) => {
          const { traveled, remaining } = buildRouteSegments(s);
          return (
            <Fragment key={s.id}>
              {traveled.length > 1 && (
                <Polyline
                  positions={traveled}
                  pathOptions={{ color: "#2563eb", weight: 4, lineCap: "round" }}
                />
              )}
              {remaining.length > 1 && (
                <Polyline
                  positions={remaining}
                  pathOptions={{ color: "#94a3b8", weight: 2.5, dashArray: "1 8", lineCap: "round" }}
                />
              )}
            </Fragment>
          );
        })}

        <Marker position={[ORIGIN.lat, ORIGIN.lng]} icon={pinIcon("ship", "#0b1c33")}>
          <Popup>
            <div className="text-xs">
              <div className="font-semibold">{ORIGIN.label}</div>
              <div className="text-text-tertiary">Origin port</div>
            </div>
          </Popup>
        </Marker>
        <Marker
          position={[MOMBASA_PORT.lat, MOMBASA_PORT.lng]}
          icon={pinIcon("anchor", "#0b1c33")}
        >
          <Popup>
            <div className="text-xs">
              <div className="font-semibold">{MOMBASA_PORT.label}</div>
              <div className="text-text-tertiary">Destination port — carrier tracking ends here</div>
            </div>
          </Popup>
        </Marker>
        <Marker
          position={[KAMPALA_ICD.lat, KAMPALA_ICD.lng]}
          icon={pinIcon("truck", "#2563eb")}
        >
          <Popup>
            <div className="text-xs">
              <div className="font-semibold">{KAMPALA_ICD.label}</div>
              <div className="text-text-tertiary">Inland Container Depot, Kampala</div>
            </div>
          </Popup>
        </Marker>
        <Marker position={[STORE.lat, STORE.lng]} icon={pinIcon("store", "#17864f")}>
          <Popup>
            <div className="text-xs">
              <div className="font-semibold">{STORE.label}</div>
              <div className="text-text-tertiary">Final delivery point</div>
            </div>
          </Popup>
        </Marker>

        {shipments.flatMap((s) =>
          (s.waypoints ?? []).map((w, i) => (
            <Marker key={`${s.id}-wp-${i}`} position={[w.lat, w.lng]} icon={waypointIcon()}>
              <Popup>
                <div className="text-xs">
                  <div className="font-semibold">{w.name}</div>
                  <div>{w.description}</div>
                  <div className="text-text-tertiary">{w.date}</div>
                </div>
              </Popup>
            </Marker>
          ))
        )}

        {shipments.map((s) => (
          <Marker
            key={s.id}
            position={[s.position.lat, s.position.lng]}
            icon={dotIcon(dotColor[s.health])}
          >
            <Popup>
              <div className="text-xs">
                <div className="font-semibold">{s.containerNumber}</div>
                <div>{s.currentStatus}</div>
                <div className="text-text-tertiary">{s.currentLocation}</div>
                {s.trackingLastSyncedAt && (
                  <div className="mt-1 text-[10px] text-text-tertiary">
                    Synced: {new Date(s.trackingLastSyncedAt).toLocaleString("en-GB")}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        <FitBounds points={trunkPoints} />
        <ZoomControls />
        <RecenterControl points={trunkPoints} />
      </MapContainer>

      <div className="absolute bottom-4 left-4 z-[1000] rounded border border-border-strong bg-surface/90 px-2 py-1 text-[11px] text-text-secondary shadow-sm">
        500 km
      </div>
    </div>
  );
}