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
 * Returns one planned-date + duration-label pair per step. A step's number
 * of days is how long it takes to REACH that step from the one before it,
 * so "Planned" for step i is the previous step's planned date plus step i's
 * own days. Order Placed is the starting point: its date is the order date,
 * it is fixed at 1 day, and it moves nothing else. The duration label always
 * reflects the CURRENT Stage Durations setting (not whatever was configured
 * when the container was first created).
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

  return steps.map((step, i) => {
    // The first step is the starting point: the order date itself, always
    // "1 day". Every later step lands its own days after the previous one.
    const days = i === 0 ? 1 : expectedDaysByStep[step] ?? 1;
    if (i > 0) cursor = new Date(cursor.getTime() + days * 24 * 60 * 60 * 1000);
    return {
      plannedDate: shortDate(cursor.toISOString()),
      plannedDateIso: cursor.toISOString(),
      durationLabel: `${days} day${days === 1 ? "" : "s"}`,
    };
  });
}