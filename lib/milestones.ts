import type { Milestone } from "@/types";

const REACHED = new Set<Milestone["status"]>(["current", "completed", "delayed"]);

/**
 * Stages are saved as a list and matched to the route by position. When a
 * route gains a stage (Manufacturing and Packaging for Aiwibi), containers
 * saved before that have one stage too few and everything after the gap
 * would shift by one. This lines a saved list up with the route by NAME,
 * inserting any missing stage. A missing stage counts as done (no date) if a
 * later stage has already been reached, and as pending otherwise. Its
 * planned date shows "TBD" until the container's durations are saved or its
 * tracking is refreshed.
 */
export function alignMilestonesToRoute(steps: readonly string[], milestones: Milestone[]): Milestone[] {
  if (milestones.length === 0) return milestones;
  const byName = new Map(milestones.map((m) => [m.name, m]));
  const aligned =
    milestones.length === steps.length && milestones.every((m, i) => m.name === steps[i]);
  if (aligned) return milestones;

  return steps.map((name, i) => {
    const existing = byName.get(name);
    if (existing) return { ...existing, id: `m-${i}`, order: i + 1 };
    const laterReached = steps.slice(i + 1).some((s) => {
      const later = byName.get(s);
      return later ? REACHED.has(later.status) : false;
    });
    return {
      id: `m-${i}`,
      order: i + 1,
      name,
      status: laterReached ? ("completed" as const) : ("pending" as const),
      plannedDate: "TBD",
      actualDate: null,
      durationLabel: "",
    };
  });
}
