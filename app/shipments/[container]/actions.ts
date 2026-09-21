"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { trackByContainer, trackByBillOfLading, TraqoError } from "@/lib/traqo/client";
import { applyTraqoEventsToMilestones } from "@/lib/traqo/mapping";
import { getRouteStepsForContainer } from "@/lib/mock-data";
import { computePlannedDates } from "@/lib/planning";
import { buildDelayReason } from "@/lib/delay";
import { buildWaypoints } from "@/lib/waypoints";
import type { Milestone } from "@/types";

export async function syncTracking({
  shipmentId,
  containerNumber,
  reference,
  referenceType,
}: {
  shipmentId: string;
  containerNumber: string;
  reference: string;
  referenceType: "container" | "bl";
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { error: "Supabase isn't configured." };

  try {
    const result =
      referenceType === "container"
        ? await trackByContainer(reference)
        : await trackByBillOfLading(reference);

    const { data: row } = await supabase
      .from("shipments")
      .select("milestones, position, etd")
      .eq("id", shipmentId)
      .single();

    const steps = getRouteStepsForContainer(containerNumber);
    const existingMilestones = (row?.milestones as Milestone[] | null) ?? [];

    // Stage Durations (set in Settings by Admin/Logistics Manager/
    // Operations Officer) is what actually computes "Planned" dates —
    // order-placed date plus each stage's expected days, cumulatively.
    const { data: durationRows } = await supabase.from("stage_durations").select("*");
    const expectedDaysByStep: Record<string, number> = {};
    for (const d of durationRows ?? []) {
      expectedDaysByStep[d.step_name as string] = d.expected_days as number;
    }

    // Per-container overrides (set on this container's own detail page)
    // take precedence over the global defaults above — this is what lets
    // two containers on the same route have different expected days.
    const { data: overrideRows } = await supabase
      .from("container_stage_durations")
      .select("*")
      .eq("container_number", containerNumber);
    for (const d of overrideRows ?? []) {
      expectedDaysByStep[d.step_name as string] = d.expected_days as number;
    }

    const plannedDates = row?.etd
      ? computePlannedDates(steps, row.etd as string, expectedDaysByStep)
      : [];

    const { milestones, currentStatus, currentLocation, health, newDelay } =
      applyTraqoEventsToMilestones(
        steps,
        existingMilestones,
        result.data.events_table,
        result.data.is_delayed,
        plannedDates
      );

    // Every real, named stop the container has actually passed through —
    // this is what lets the map draw the route through Singapore (or
    // wherever else) instead of just a straight guess, and also gives us
    // a trustworthy fallback position below.
    const waypoints = buildWaypoints(result.data.events_table);

    // Traqo returns the vessel's real live position (lat/lng) — when
    // present, this is what moves the dot on the shared map from the
    // fixed generic point to where the ship actually is. When it's
    // missing, falling back to whatever was already stored risks
    // showing a long-stale (or, early on, placeholder) position — the
    // most recent confirmed waypoint is a real, known-true location, so
    // that's a more honest fallback than "whatever was there before".
    const hasRealPosition =
      typeof result.data.latitude === "number" && typeof result.data.longitude === "number";
    const lastWaypoint = waypoints[waypoints.length - 1];
    const position = hasRealPosition
      ? { lat: result.data.latitude, lng: result.data.longitude, label: currentLocation || containerNumber }
      : lastWaypoint
      ? { lat: lastWaypoint.lat, lng: lastWaypoint.lng, label: lastWaypoint.name }
      : row?.position ?? undefined;

    // Traqo's own ETA replaces the placeholder guess (order date + 28
    // days) set when the container was first added — that guess was
    // never meant to be final, just a starting point before real
    // carrier data existed.
    const realEta = result.data.eta ? result.data.eta.split(" ")[0] : undefined;

    const delayReason = newDelay
      ? buildDelayReason(newDelay.name, newDelay.plannedDateIso, newDelay.actualDateIso, newDelay.daysLate)
      : undefined;

    const { error } = await supabase
      .from("shipments")
      .update({
        tracking_reference: reference,
        tracking_reference_type: referenceType,
        shipping_line: result.data.sealine_name || undefined,
        milestones,
        waypoints,
        current_status: currentStatus,
        current_location: currentLocation || undefined,
        health,
        position,
        eta: realEta,
        final_eta: realEta,
        ...(newDelay && {
          delay_days: newDelay.daysLate,
          delay_reason: delayReason,
          delay_reported_at: new Date().toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
          }),
        }),
        tracking_last_synced_at: new Date().toISOString(),
      })
      .eq("id", shipmentId);

    if (error) return { error: error.message };

    // A newly-detected delay also raises an alert — this is what feeds
    // the Alerts page and the notification bell.
    if (newDelay && delayReason) {
      await supabase.from("alerts").insert({
        severity: "warning",
        shipment_number: containerNumber,
        title: `Delay at ${newDelay.name}`,
        description: delayReason,
        acknowledged: false,
      });
    }

    revalidatePath(`/shipments/${containerNumber}`);
    revalidatePath("/");
    revalidatePath("/overview");
    revalidatePath("/alerts");
    return { success: true };
  } catch (e) {
    if (e instanceof TraqoError) return { error: e.message };
    return { error: "Something went wrong reaching the tracking service." };
  }
}