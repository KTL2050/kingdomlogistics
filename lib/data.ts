import type { Alert, AppUser, KpiSummary, PlannedOrder, Shipment } from "@/types";
import {
  alerts as mockAlerts,
  currentUser,
  plannedOrders as mockPlannedOrders,
  shipments as mockShipments,
} from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Every function here reads from Supabase when a real project is wired
 * up (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY set) and
 * otherwise returns the bundled mock data. Pages should only ever import
 * from this file, never from mock-data.ts or the supabase client directly
 * — that keeps the swap to a live backend a one-file change.
 */

// The DB uses snake_case columns; the app uses camelCase fields
// everywhere else. Map explicitly, field by field — a raw pass-through
// cast looks fine until real data arrives with names that don't match,
// which is exactly the bug this file used to have.
function mapShipmentRow(row: Record<string, unknown>): Shipment {
  return {
    id: row.id as string,
    shipmentNumber: row.shipment_number as string,
    containerNumber: row.container_number as string,
    origin: row.origin as string,
    destination: row.destination as string,
    routeVia: Array.isArray(row.route_via) ? (row.route_via as string[]) : [],
    shippingLine: row.shipping_line as string,
    containerSize: row.container_size as Shipment["containerSize"],
    mode: row.mode as Shipment["mode"],
    etd: row.etd as string,
    eta: row.eta as string,
    finalEta: row.final_eta as string,
    currentStatus: row.current_status as string,
    currentLocation: row.current_location as string,
    health: row.health as Shipment["health"],
    delayDays: (row.delay_days as number) ?? 0,
    customer: row.customer as string,
    position: (row.position as Shipment["position"]) ?? { lat: 0, lng: 0, label: "" },
    milestones: Array.isArray(row.milestones) ? (row.milestones as Shipment["milestones"]) : [],
    waypoints: Array.isArray(row.waypoints) ? (row.waypoints as Shipment["waypoints"]) : [],
    delayReason: (row.delay_reason as string | null) ?? undefined,
    delayReportedAt: (row.delay_reported_at as string | null) ?? undefined,
    trackingReference: (row.tracking_reference as string | null) ?? undefined,
    trackingReferenceType: (row.tracking_reference_type as Shipment["trackingReferenceType"]) ?? undefined,
    trackingLastSyncedAt: (row.tracking_last_synced_at as string | null) ?? undefined,
  };
}

function mapAlertRow(row: Record<string, unknown>): Alert {
  const createdAt = row.created_at ? new Date(row.created_at as string) : new Date();
  return {
    id: row.id as string,
    severity: row.severity as Alert["severity"],
    shipmentNumber: (row.shipment_number as string | null) ?? "",
    title: row.title as string,
    description: row.description as string,
    timestamp: createdAt.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    acknowledged: Boolean(row.acknowledged),
    managerNote: (row.manager_note as string | null) ?? undefined,
    managerNoteBy: (row.manager_note_by as string | null) ?? undefined,
    managerNoteAt: row.manager_note_at
      ? new Date(row.manager_note_at as string).toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : undefined,
  };
}

function mapPlannedOrderRow(row: Record<string, unknown>): PlannedOrder {
  return {
    id: row.id as string,
    company: row.company as PlannedOrder["company"],
    frequency: row.frequency as PlannedOrder["frequency"],
    customIntervalDays: (row.custom_interval_days as number | null) ?? undefined,
    anchorDate: row.anchor_date as string,
    leadTimeDays: (row.lead_time_days as number) ?? 7,
    notes: (row.notes as string | null) ?? undefined,
    active: row.active !== false,
    containerNumber: (row.container_number as string | null) ?? undefined,
    containerSize: (row.container_size as PlannedOrder["containerSize"] | null) ?? undefined,
    importedMombasaEta: (row.imported_mombasa_eta as string | null) ?? undefined,
    importedStoreDate: (row.imported_store_date as string | null) ?? undefined,
    importedActual: (row.imported_actual as string | null) ?? undefined,
  };
}

export async function getPlannedOrders(): Promise<PlannedOrder[]> {
  if (isSupabaseConfigured) {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("planned_orders")
        .select("*")
        .order("anchor_date", { ascending: true });

      if (!error && data) {
        return data.map(mapPlannedOrderRow);
      }

      if (error) {
        console.error("Supabase getPlannedOrders() failed, falling back to mock data:", error.message);
      }
    }
  }
  return mockPlannedOrders;
}

export async function getShipments(): Promise<Shipment[]> {
  if (isSupabaseConfigured) {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("shipments")
        .select("*")
        .order("eta", { ascending: true });

      if (!error && data) {
        return data.map(mapShipmentRow);
      }

      if (error) {
        console.error("Supabase getShipments() failed, falling back to mock data:", error.message);
      }
    }
  }
  return mockShipments;
}

export async function getShipmentByContainer(
  containerNumber: string
): Promise<Shipment | undefined> {
  const all = await getShipments();
  return all.find((s) => s.containerNumber === containerNumber);
}

export async function getAlerts(): Promise<Alert[]> {
  if (isSupabaseConfigured) {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) return data.map(mapAlertRow);

      // This used to fail silently — unlike every other function here —
      // which is exactly the kind of thing that hides an RLS or schema
      // mismatch behind what looks like "zero alerts" in the UI.
      if (error) {
        console.error("Supabase getAlerts() failed, falling back to mock data:", error.message);
      }
    }
  }
  return mockAlerts;
}

export async function getKpiSummary(): Promise<KpiSummary> {
  const all = await getShipments();
  return {
    total: all.length,
    onTime: all.filter((s) => s.health === "on_time" || s.health === "completed")
      .length,
    delayed: all.filter((s) => s.health === "delayed").length,
    notStarted: all.filter((s) => s.health === "not_started").length,
  };
}

export async function getCurrentUser(): Promise<AppUser | null> {
  if (!isSupabaseConfigured) return currentUser;

  const supabase = await createServerSupabaseClient();
  if (!supabase) return currentUser;

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    // Nobody's actually logged in in this browser (e.g. they signed up
    // but haven't confirmed their email yet, so no session exists).
    // A real Supabase project is connected, so this is genuinely "not
    // signed in" — not the same thing as demo/mock mode — and should
    // send them to the login page, not quietly show the mock user.
    return null;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (profile) {
    // The DB column is full_name (snake_case); the app expects
    // fullName (camelCase) everywhere else — map it explicitly
    // rather than passing the raw row straight through.
    return {
      id: profile.id as string,
      fullName: (profile.full_name as string) || data.user.email || "Signed in",
      role: profile.role as AppUser["role"],
      status: profile.status as AppUser["status"],
      email: (profile.email as string | null) ?? data.user.email,
    };
  }

  // No row in the `users` table yet (shouldn't normally happen now
  // that the signup trigger creates one automatically, but kept as
  // a safety net) — treat as pending rather than silently letting
  // an unrecognized account through.
  return {
    id: data.user.id,
    fullName:
      (data.user.user_metadata?.full_name as string | undefined) ||
      data.user.email ||
      "Signed in",
    role: "Viewer" as const,
    status: "pending" as const,
    email: data.user.email,
  };
}