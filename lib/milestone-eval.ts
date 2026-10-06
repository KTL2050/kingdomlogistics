import { checkDelay, isAutoDelayReason } from "@/lib/delay";
import type { Milestone } from "@/types";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A milestone stores its actual date as a short label like "27 Aug" — no
 * year, since that's all the timeline needed to display. Comparing one
 * against a planned date means working the year back out. Real actual
 * dates never fall meaningfully before the order was placed, so use the
 * order's year unless that would put it more than ~2 months before the
 * order date (which means it rolled over into the next year).
 */
export function actualDateToIso(shortLabel: string, orderDateIso: string): string | null {
  const match = shortLabel.trim().match(/^(\d{1,2})\s+([A-Za-z]{3,})/);
  if (!match) return null;
  const month = MONTHS.indexOf(match[2].slice(0, 3).toLowerCase());
  if (month === -1) return null;

  const order = new Date(orderDateIso);
  if (Number.isNaN(order.getTime())) return null;

  const day = Number(match[1]);
  const year = order.getUTCFullYear();
  let candidate = Date.UTC(year, month, day);
  if (candidate < order.getTime() - 60 * DAY_MS) {
    candidate = Date.UTC(year + 1, month, day);
  }
  return new Date(candidate).toISOString();
}

export interface ReevaluatedMilestones {
  milestones: Milestone[];
  /** Whether any stage was marked delayed before re-checking. */
  hadDelay: boolean;
  /** Whether any stage is marked delayed after re-checking. */
  hasDelay: boolean;
  maxDaysLate: number;
}

/**
 * Re-checks every already-reached stage against its CURRENT planned date.
 * Needed because changing a stage's duration moves the planned dates of
 * everything after it, but a stage that was flagged "delayed" under the
 * old plan stays flagged forever unless something re-evaluates it —
 * which is how a stage that now arrived early kept showing "18 days
 * late". Only stages that have an actual date and are already settled
 * ("completed" or "delayed") are touched; in-progress and not-yet-reached
 * stages are left alone.
 */
export function reevaluateMilestones(
  milestones: Milestone[],
  orderDateIso: string
): ReevaluatedMilestones {
  const hadDelay = milestones.some((m) => m.status === "delayed");

  const next = milestones.map((m): Milestone => {
    const settled = m.status === "completed" || m.status === "delayed";
    if (!m.actualDate || !m.plannedDateIso || !settled) return m;

    const actualIso = actualDateToIso(m.actualDate, orderDateIso);
    if (!actualIso) return m;

    const result = checkDelay(m.plannedDateIso, actualIso);
    if (result.isDelayed) {
      return { ...m, status: "delayed", daysLate: result.daysLate };
    }

    const onTime: Milestone = { ...m, status: "completed" };
    delete onTime.daysLate;
    // Only auto-generated "X days late" text goes — a reason a manager
    // actually typed is theirs to keep, whatever the stage's status is.
    if (onTime.delayReason && isAutoDelayReason(m.name, onTime.delayReason)) {
      delete onTime.delayReason;
      delete onTime.delayReportedAt;
    }
    return onTime;
  });

  const lateness = next
    .filter((m) => m.status === "delayed")
    .map((m) => m.daysLate ?? 0);

  return {
    milestones: next,
    hadDelay,
    hasDelay: lateness.length > 0,
    maxDaysLate: lateness.length > 0 ? Math.max(...lateness) : 0,
  };
}
