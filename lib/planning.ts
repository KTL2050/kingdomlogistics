function shortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export interface PlannedStep {
  plannedDate: string;
  plannedDateIso: string;
  durationLabel: string;
}

/**
 * Returns one planned-date + duration-label pair per step, computed by
 * starting at the order-placed date and adding each step's own expected
 * duration before moving to the next — so "Planned" for step i is the
 * order date plus the sum of every prior step's expected days, and its
 * duration label always reflects the CURRENT Stage Durations setting
 * (not whatever was configured when the container was first created).
 * Falls back to 1 day for any step missing from the settings, so a gap
 * in configuration doesn't break the whole timeline.
 *
 * plannedDateIso is the same date in full ISO form — plannedDate ("16
 * Sept") has no year and isn't safe to compare for delay detection, so
 * anything that needs to check "did this arrive late" should compare
 * against plannedDateIso instead.
 */
export function computePlannedDates(
  steps: readonly string[],
  orderPlacedIso: string,
  expectedDaysByStep: Record<string, number>
): PlannedStep[] {
  let cursor = new Date(orderPlacedIso);
  const result: PlannedStep[] = [];

  for (const step of steps) {
    const days = expectedDaysByStep[step] ?? 1;
    result.push({
      plannedDate: shortDate(cursor.toISOString()),
      plannedDateIso: cursor.toISOString(),
      durationLabel: `${days} day${days === 1 ? "" : "s"}`,
    });
    cursor = new Date(cursor.getTime() + days * 24 * 60 * 60 * 1000);
  }

  return result;
}