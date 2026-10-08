"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { trackByContainer, trackByBillOfLading, TraqoError } from "@/lib/traqo/client";
import { applyTraqoEventsToMilestones } from "@/lib/traqo/mapping";
import { getRouteStepsForContainer } from "@/lib/mock-data";
import { computePlannedDates } from "@/lib/planning";
import { buildDelayReason } from "@/lib/delay";
import { buildWaypoints } from "@/lib/waypoints";
import { getCurrentUser, getShipments } from "@/lib/data";
import type { Milestone } from "@/types";

// Index of the furthest stage the container has reached (or is at) — -1
// if none. A stage that was reached late is "delayed", but it has still
// been reached, so it counts.
function furthestReachedIndex(milestones: Milestone[]): number {
  let furthest = -1;
  milestones.forEach((m, i) => {
    if (m.status === "current" || m.status === "completed" || m.status === "delayed") furthest = i;
  });
  return furthest;
}

function describeStageReached(
  containerNumber: string,
  stageName: string,
  nextStageName: string | undefined
): { title: string; description: string } {
  const informedNext = nextStageName
    ? `You will be informed when it reaches ${nextStageName}.`
    : "This is the final stage.";
  switch (stageName) {
    case "Container Loaded":
      return {
        title: `${containerNumber} has been loaded`,
        description: `${containerNumber} is loaded on the vessel. ${informedNext}`,
      };
    case "On the High Seas":
      return {
        title: `${containerNumber} is on the High Seas`,
        description: `${containerNumber} has set sail. ${informedNext}`,
      };
    case "Mombasa Port":
      return {
        title: `${containerNumber} has reached Mombasa Port`,
        description: `${containerNumber} has arrived at Mombasa Port. Carrier tracking ends here, so the inland leg will be updated by the Logistics Manager.`,
      };
    default:
      return {
        title: `${containerNumber}: ${stageName}`,
        description: `${containerNumber} has reached ${stageName}. ${informedNext}`,
      };
  }
}

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
  const result = await syncShipmentTracking({ shipmentId, containerNumber, reference, referenceType });
  if ("success" in result) {
    revalidatePath(`/shipments/${containerNumber}`);
    revalidatePath("/");
    revalidatePath("/overview");
    revalidatePath("/alerts");
  }
  return result;
}

async function syncShipmentTracking({
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
    const waypoints = await buildWaypoints(result.data.events_table);

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

    // Stored on the specific milestone (not just the shared shipment-level
    // field below) so a later delay at a different stage can't silently
    // overwrite this one's reason.
    const milestonesWithReason =
      newDelay && delayReason
        ? milestones.map((m) =>
            m.name === newDelay.name
              ? {
                  ...m,
                  delayReason,
                  delayReportedAt: new Date().toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                  }),
                }
              : m
          )
        : milestones;

    const { error } = await supabase
      .from("shipments")
      .update({
        tracking_reference: reference,
        tracking_reference_type: referenceType,
        shipping_line: result.data.sealine_name || undefined,
        milestones: milestonesWithReason,
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
    // the Alerts page and the notification bell. The tracking sync
    // itself already succeeded at this point, so a failed notification
    // here shouldn't fail the whole sync — but it must still be logged,
    // not silently dropped, or a real failure looks identical to success.
    if (newDelay && delayReason) {
      const { error: alertError } = await supabase.from("alerts").insert({
        severity: "warning",
        shipment_number: containerNumber,
        title: `Delay at ${newDelay.name}`,
        description: delayReason,
        acknowledged: false,
      });
      if (alertError) {
        console.error("Failed to create delay alert after tracking sync:", alertError.message);
      }
    }

    // Tell the team when the container moves on to a new stage — only on
    // the sync that first sees it there, so a refresh with no change
    // stays silent. If it jumped several stages between syncs, one alert
    // for the stage it's actually at now is enough. "Order Placed" is
    // skipped: it's set when the container is created, not by tracking.
    const previousStage = furthestReachedIndex(existingMilestones);
    const currentStage = furthestReachedIndex(milestonesWithReason);
    if (currentStage > previousStage && currentStage >= 1) {
      const stageName = steps[currentStage];
      const nextName = steps[currentStage + 1];
      const { title, description } = describeStageReached(containerNumber, stageName, nextName);
      const { error: progressAlertError } = await supabase.from("alerts").insert({
        severity: "info",
        shipment_number: containerNumber,
        title,
        description,
        acknowledged: false,
      });
      if (progressAlertError) {
        console.error("Failed to create stage-progress alert after tracking sync:", progressAlertError.message);
      }
    }

    return { success: true };
  } catch (e) {
    if (e instanceof TraqoError) return { error: e.message };
    return { error: "Something went wrong reaching the tracking service." };
  }
}

export async function refreshActiveTracking(): Promise<{
  attempted: number;
  refreshed: number;
  failed: number;
  errors: string[];
}> {
  const user = await getCurrentUser();
  if (!user || user.role === "Viewer") {
    return { attempted: 0, refreshed: 0, failed: 0, errors: ["Not authorized."] };
  }

  const shipments = await getShipments();
  const targets = shipments.filter(
    (s) =>
      (s.health === "on_time" || s.health === "delayed") &&
      s.trackingReference &&
      s.trackingReferenceType
  );

  const results = await Promise.allSettled(
    targets.map((s) =>
      syncShipmentTracking({
        shipmentId: s.id,
        containerNumber: s.containerNumber,
        reference: s.trackingReference!,
        referenceType: s.trackingReferenceType!,
      })
    )
  );

  const errors: string[] = [];
  let refreshed = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && "success" in r.value) {
      refreshed++;
    } else {
      const message = r.status === "fulfilled" && "error" in r.value ? r.value.error : "Unexpected error.";
      errors.push(`${targets[i].containerNumber}: ${message}`);
    }
  });

  targets.forEach((s) => revalidatePath(`/shipments/${s.containerNumber}`));
  if (refreshed > 0) {
    revalidatePath("/");
    revalidatePath("/overview");
    revalidatePath("/alerts");
  }

  return { attempted: targets.length, refreshed, failed: targets.length - refreshed, errors };
}