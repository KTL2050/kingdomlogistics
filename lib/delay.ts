export interface DelayCheck {
  isDelayed: boolean;
  daysLate: number;
}

/**
 * Compares a stage's actual arrival against its planned date. Anything
 * even one day late counts — no grace window, since the point is to
 * surface real slippage, not decide how much is acceptable.
 */
export function checkDelay(
  plannedDateIso: string | undefined,
  actualDateIso: string
): DelayCheck {
  if (!plannedDateIso) return { isDelayed: false, daysLate: 0 };

  const planned = new Date(plannedDateIso);
  const actual = new Date(actualDateIso);
  if (Number.isNaN(planned.getTime()) || Number.isNaN(actual.getTime())) {
    return { isDelayed: false, daysLate: 0 };
  }

  const daysLate = Math.round((actual.getTime() - planned.getTime()) / (24 * 60 * 60 * 1000));
  return { isDelayed: daysLate > 0, daysLate: Math.max(daysLate, 0) };
}

function shortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/**
 * Builds the human-readable reason shown on the shipment card and used
 * as the alert description — e.g. "Delayed at Mombasa Port — planned 20
 * Sept, arrived 29 Sept (9 days late)."
 */
export function buildDelayReason(
  stageName: string,
  plannedDateIso: string,
  actualDateIso: string,
  daysLate: number
): string {
  return `Delayed at ${stageName} — planned ${shortDate(plannedDateIso)}, arrived ${shortDate(
    actualDateIso
  )} (${daysLate} day${daysLate === 1 ? "" : "s"} late).`;
}