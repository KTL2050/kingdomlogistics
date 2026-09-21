import type { Milestone } from "@/types";
import type { TraqoEvent } from "@/lib/traqo/client";
import type { PlannedStep } from "@/lib/planning";
import { checkDelay } from "@/lib/delay";

/**
 * Traqo (like any ocean-carrier tracker) only ever sees the port-to-port
 * leg — it has no visibility past the destination port gate. So this
 * mapping only ever touches "Container Loaded" through "Mombasa Port".
 * "Order Placed" is always set manually at container-creation time, and
 * everything after Mombasa Port (Enroute to Kampala, At ICD, Arrived at
 * Store) stays a manual update, same as it is today — this function
 * never writes to those steps.
 */
const EVENT_TO_STEP: Record<string, string> = {
  GTIN: "Container Loaded", // gated in at origin port, about to load
  LOAD: "Container Loaded", // loaded on vessel — this step is done
  DEPA: "On the High Seas", // vessel departed — now at sea
  ARRI: "Mombasa Port", // vessel arrived at destination port
  DISC: "Mombasa Port", // discharged at destination port
  GTOT: "Mombasa Port", // gated out of the port — last thing Traqo ever sees
};

// A route with a transshipment stop reports GTIN/LOAD twice (once at
// origin, once at the transshipment port) and ARRI/DISC twice (once at
// the transshipment port, once at the real destination). Only a step's
// FIRST matching event is what actually corresponds to it — a second
// loading/departure at a transshipment hub isn't a new milestone in our
// simplified route, it's the same leg continuing.
const EARLIEST_WINS = new Set(["Container Loaded", "On the High Seas"]);

function shortDate(iso: string) {
  const d = new Date(iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export interface DelayedStage {
  name: string;
  plannedDateIso: string;
  actualDateIso: string;
  daysLate: number;
}

/**
 * Applies the latest Traqo events onto an existing milestone list for
 * one shipment. Steps beyond "Mombasa Port" are left completely
 * untouched for progress/actual-date purposes, so any manual progress a
 * logistics manager already recorded for the inland leg is preserved —
 * but planned dates and duration labels DO refresh for every step, every
 * sync, since those come from Stage Durations settings and should never
 * go stale.
 *
 * When a step's real arrival date comes in later than its planned date,
 * that step is marked "delayed" instead of "completed", and the newly
 * detected delay (if any) is returned separately so the caller can
 * record it as an alert — only for the FIRST sync that discovers it, not
 * every subsequent refresh.
 */
export function applyTraqoEventsToMilestones(
  steps: readonly string[],
  existingMilestones: Milestone[],
  events: TraqoEvent[],
  isDelayed: boolean,
  plannedSteps: PlannedStep[]
): {
  milestones: Milestone[];
  currentStatus: string;
  currentLocation: string;
  health: "on_time" | "delayed";
  newDelay: DelayedStage | null;
} {
  // Only real, already-happened events count toward progress —
  // `is_actual: 0` events (like a future planned arrival) must never
  // be read as something that already occurred.
  const actualEvents = events.filter((e) => e.is_actual === 1);
  const mombasaIndex = steps.indexOf("Mombasa Port");

  const eventForStep = new Map<number, TraqoEvent>();
  for (const event of actualEvents) {
    const stepName = EVENT_TO_STEP[event.event_code];
    if (!stepName) continue;
    const idx = steps.indexOf(stepName);
    if (idx === -1) continue;

    // Guard against transshipment stops: a discharge/arrival only counts
    // as "Mombasa Port" if it actually happened at Mombasa — otherwise a
    // discharge at a transshipment hub (e.g. Singapore, mid-journey)
    // gets mistaken for having reached the final destination.
    if (stepName === "Mombasa Port" && !event.location?.toLowerCase().includes("mombasa")) {
      continue;
    }

    const current = eventForStep.get(idx);
    if (!current) {
      eventForStep.set(idx, event);
      continue;
    }
    const isEarlier = new Date(event.timestamp) < new Date(current.timestamp);
    const isLater = new Date(event.timestamp) > new Date(current.timestamp);
    if ((EARLIEST_WINS.has(stepName) && isEarlier) || (!EARLIEST_WINS.has(stepName) && isLater)) {
      eventForStep.set(idx, event);
    }
  }

  // Nothing recognizable happened yet — keep progress as-is, but still
  // refresh planned dates/duration labels (an admin may have updated
  // Stage Durations since this was last synced).
  if (eventForStep.size === 0) {
    const milestones = existingMilestones.map((m, i) => ({
      ...m,
      plannedDate: plannedSteps[i]?.plannedDate ?? m.plannedDate,
      plannedDateIso: plannedSteps[i]?.plannedDateIso ?? m.plannedDateIso,
      durationLabel: plannedSteps[i]?.durationLabel ?? m.durationLabel,
    }));
    const alreadyDelayed = existingMilestones.some((m) => m.status === "delayed");
    return {
      milestones,
      currentStatus: existingMilestones.find((m) => m.status === "current")?.name ?? steps[0],
      currentLocation: "",
      health: alreadyDelayed || isDelayed ? "delayed" : "on_time",
      newDelay: null,
    };
  }

  const reachedIndex = Math.max(...eventForStep.keys());
  const latestEvent = eventForStep.get(reachedIndex)!;

  const fullyDischarged = actualEvents.some(
    (e) =>
      (e.event_code === "GTOT" || e.event_code === "DISC") &&
      e.location?.toLowerCase().includes("mombasa")
  );
  // Once fully discharged/gated-out at Mombasa specifically, that step
  // counts as done — the manager takes it from there manually.
  const currentIndex = fullyDischarged && reachedIndex === mombasaIndex ? reachedIndex + 1 : reachedIndex;

  let newDelay: DelayedStage | null = null;

  const milestones = steps.map((name, i) => {
    const existing = existingMilestones[i];
    const planned = plannedSteps[i];
    // Never touch progress/actual data past Mombasa Port — that's the
    // manual leg — but planned date + duration label still refresh.
    if (mombasaIndex !== -1 && i > mombasaIndex) {
      return {
        id: existing?.id ?? `m-${i}`,
        order: i + 1,
        name,
        status: existing?.status ?? "pending",
        plannedDate: planned?.plannedDate ?? existing?.plannedDate ?? "TBD",
        plannedDateIso: planned?.plannedDateIso ?? existing?.plannedDateIso,
        actualDate: existing?.actualDate ?? null,
        durationLabel: planned?.durationLabel ?? existing?.durationLabel ?? "",
      };
    }

    let status: Milestone["status"] = "pending";
    if (i < currentIndex) status = "completed";
    else if (i === currentIndex) status = "current";

    const stepEvent = eventForStep.get(i);

    // A step whose real arrival date just came in — check it against
    // its planned date. Only the step that JUST got confirmed this
    // sync is checked; already-completed steps from a prior sync (with
    // no stored comparable date) are left as they were rather than
    // guessed at retroactively.
    if (stepEvent && status === "completed") {
      const delayResult = checkDelay(planned?.plannedDateIso, stepEvent.timestamp);
      if (delayResult.isDelayed) {
        status = "delayed";
        if (existing?.status !== "delayed") {
          newDelay = {
            name,
            plannedDateIso: planned!.plannedDateIso,
            actualDateIso: stepEvent.timestamp,
            daysLate: delayResult.daysLate,
          };
        }
      }
    }

    return {
      id: `m-${i}`,
      order: i + 1,
      name,
      status,
      plannedDate: planned?.plannedDate ?? existing?.plannedDate ?? "TBD",
      plannedDateIso: planned?.plannedDateIso ?? existing?.plannedDateIso,
      actualDate: stepEvent
        ? shortDate(stepEvent.timestamp)
        : i < currentIndex
        ? existing?.actualDate ?? null // implied complete (a later step fired) but no direct event for this one
        : null,
      durationLabel: planned?.durationLabel ?? existing?.durationLabel ?? "",
    };
  });

  const activeStep = milestones[Math.min(currentIndex, steps.length - 1)];

  const anyMilestoneDelayed = milestones.some((m) => m.status === "delayed");
  return {
    milestones,
    currentStatus: activeStep?.name ?? steps[reachedIndex],
    currentLocation: latestEvent.location,
    health: anyMilestoneDelayed || isDelayed ? "delayed" : "on_time",
    newDelay,
  };
}