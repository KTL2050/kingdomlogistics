// Domain types. These intentionally mirror the Supabase table shapes in
// lib/supabase/schema.sql so the mock data layer and the real data layer
// are interchangeable — swap lib/data.ts's source without touching the UI.

export type ShipmentMode = "FCL" | "LCL" | "Air" | "Breakbulk";

export type ContainerSize = "20ft" | "40ft" | "40ft HC" | "45ft";

export type MilestoneStatus = "completed" | "current" | "delayed" | "pending";

export type ShipmentHealth = "on_time" | "delayed" | "not_started" | "completed";

export type UserRole =
  | "Admin"
  | "Logistics Manager"
  | "Operations Officer"
  | "Viewer";

export type AlertSeverity = "critical" | "warning" | "info";

export type UserStatus = "pending" | "approved" | "rejected";

export interface AppUser {
  id: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  email?: string;
  avatarUrl?: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
}

export interface Milestone {
  id: string;
  order: number;
  name: string;
  status: MilestoneStatus;
  plannedDate: string;
  actualDate: string | null;
  durationLabel: string;
  plannedDateIso?: string;
}

export interface Waypoint {
  name: string;
  lat: number;
  lng: number;
  date: string;
  description: string;
}

export interface Shipment {
  id: string;
  shipmentNumber: string;
  containerNumber: string;
  origin: string;
  destination: string;
  routeVia: string[];
  shippingLine: string;
  containerSize: ContainerSize;
  mode: ShipmentMode;
  etd: string;
  eta: string;
  finalEta: string;
  currentStatus: string;
  currentLocation: string;
  health: ShipmentHealth;
  delayDays: number;
  customer: string;
  position: GeoPoint;
  milestones: Milestone[];
  waypoints?: Waypoint[];
  delayReason?: string;
  delayReportedAt?: string;
  trackingReference?: string;
  trackingReferenceType?: "container" | "bl";
  trackingLastSyncedAt?: string;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  shipmentNumber: string;
  title: string;
  description: string;
  timestamp: string;
  acknowledged: boolean;
  /**
   * A justification a Logistics Manager/Admin/Operations Officer added
   * for this specific delay — visible to every user who can see the
   * alert, unlike the auto-generated description above.
   */
  managerNote?: string;
  managerNoteBy?: string;
  managerNoteAt?: string;
}

export interface KpiSummary {
  total: number;
  onTime: number;
  delayed: number;
  notStarted: number;
}

export type OrderFrequency = "monthly" | "quarterly" | "yearly" | "custom";

/**
 * A recurring "when to place the next order" schedule for a company —
 * not a single order. anchorDate is any one real occurrence (past or
 * future); lib/order-planning.ts walks forward from it by `frequency` to
 * find the next due date, which is what the reminder system watches.
 */
export interface PlannedOrder {
  id: string;
  company: "Uncle Bills" | "Aiwibi Uganda";
  frequency: OrderFrequency;
  /** Only used when frequency === "custom": days between occurrences. */
  customIntervalDays?: number;
  anchorDate: string;
  /** Start surfacing a daily reminder this many days before the due date. */
  leadTimeDays: number;
  notes?: string;
  active: boolean;
  /**
   * The container this schedule's most recently placed order became —
   * set when marking an order as placed, so its Mombasa ETA / Store Date
   * can be pulled straight from that container's real shipment tracking.
   */
  containerNumber?: string;
  /** The container size this order is for — falls back to the linked
   * container's real size (once tracked) if not set explicitly here. */
  containerSize?: ContainerSize;
  /**
   * Mombasa ETA / Store Date / Actual as brought in from a bulk Excel/CSV
   * import (lib/order-import.ts) — shown for the Placed occurrence when
   * there's no live-tracked Shipment for containerNumber to read the real
   * values from. Live tracking data always takes precedence when present.
   */
  importedMombasaEta?: string;
  importedStoreDate?: string;
  importedActual?: string;
}