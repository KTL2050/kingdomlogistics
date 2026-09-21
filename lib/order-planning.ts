import type { OrderFrequency, PlannedOrder } from "@/types";

export const ORDER_FREQUENCY_LABELS: Record<OrderFrequency, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  custom: "Custom",
};

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function stepForward(date: Date, order: PlannedOrder): Date {
  const next = new Date(date);
  switch (order.frequency) {
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
    case "custom":
      next.setDate(next.getDate() + Math.max(1, order.customIntervalDays ?? 30));
      break;
  }
  return next;
}

/**
 * Every date this schedule has an order due between rangeStart and
 * rangeEnd (inclusive). Walks forward one occurrence at a time from the
 * anchor date rather than computing a closed-form offset — Date already
 * handles month-length and leap-year edge cases correctly, so there's no
 * need to reimplement that.
 */
export function getOrderOccurrences(
  order: PlannedOrder,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  const occurrences: Date[] = [];
  let cursor = startOfDay(new Date(order.anchorDate));
  const start = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);
  let guard = 0;

  while (cursor < start && guard < 1000) {
    cursor = stepForward(cursor, order);
    guard += 1;
  }
  while (cursor <= end && guard < 2000) {
    occurrences.push(cursor);
    cursor = stepForward(cursor, order);
    guard += 1;
  }

  return occurrences;
}

/** The nearest occurrence that hasn't passed yet — today counts as due. */
export function getNextOccurrence(order: PlannedOrder, today: Date = new Date()): Date {
  const start = startOfDay(today);
  let cursor = startOfDay(new Date(order.anchorDate));
  let guard = 0;
  while (cursor < start && guard < 1000) {
    cursor = stepForward(cursor, order);
    guard += 1;
  }
  return cursor;
}

export interface DueSoonOrder {
  order: PlannedOrder;
  nextOccurrence: Date;
  daysUntil: number;
  overdue: boolean;
}

/**
 * Orders whose next occurrence has entered their own lead-time window.
 * This is what should be shown as a reminder every day: the same
 * schedule keeps reappearing here (daysUntil counting down, then
 * negative once overdue) until it's either placed — which should move
 * anchorDate forward, e.g. to today — or deactivated.
 */
export function getDueSoonOrders(
  orders: PlannedOrder[],
  today: Date = new Date()
): DueSoonOrder[] {
  const start = startOfDay(today);
  return orders
    .filter((o) => o.active)
    .map((order) => {
      const nextOccurrence = getNextOccurrence(order, start);
      const daysUntil = Math.round(
        (nextOccurrence.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
      );
      return { order, nextOccurrence, daysUntil, overdue: daysUntil < 0 };
    })
    .filter(({ daysUntil, order }) => daysUntil <= order.leadTimeDays)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

/** Where a due date sits relative to today, for badge/banner coloring. */
export function dueSoonSeverity(daysUntil: number): "critical" | "warning" | "info" {
  if (daysUntil <= 1) return "critical";
  if (daysUntil <= 3) return "warning";
  return "info";
}

export type OccurrenceStatus = "Placed" | "Overdue" | "Due Today" | "Due Soon" | "Upcoming" | "Past";

/**
 * What a single occurrence row means relative to today. "Placed" is the
 * one occurrence that matches the schedule's own anchorDate exactly, as
 * long as that date isn't in the future — marking an order placed moves
 * anchorDate to that real date, but a schedule that's never been placed
 * yet also has an anchorDate (just its next due date), which must NOT
 * read as "Placed" before it's actually happened. Everything before it
 * is "Past" (a prior cycle we don't have a record of); everything after
 * follows the same lead-time window as the due-soon reminder.
 */
export function describeOccurrenceStatus(
  order: PlannedOrder,
  occurrence: Date,
  today: Date = new Date()
): OccurrenceStatus {
  const day = startOfDay(occurrence).getTime();
  const anchor = startOfDay(new Date(order.anchorDate)).getTime();
  const now = startOfDay(today).getTime();

  if (day === anchor && anchor <= now) return "Placed";
  if (day < now) return "Past";

  const daysUntil = Math.round((day - now) / (24 * 60 * 60 * 1000));
  if (daysUntil === 0) return "Due Today";
  if (daysUntil < 0) return "Overdue";
  if (daysUntil <= order.leadTimeDays) return "Due Soon";
  return "Upcoming";
}

export type OrderPlanningTimeframe = "monthly" | "quarterly" | "yearly" | "custom";

/** The [start, end] window a timeframe tab represents, anchored on today. */
export function getTimeframeRange(
  timeframe: OrderPlanningTimeframe,
  today: Date = new Date(),
  customRange?: { start: string; end: string }
): { start: Date; end: Date } {
  const year = today.getFullYear();
  const month = today.getMonth();

  if (timeframe === "monthly") {
    return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0) };
  }
  if (timeframe === "quarterly") {
    const quarterStartMonth = Math.floor(month / 3) * 3;
    return {
      start: new Date(year, quarterStartMonth, 1),
      end: new Date(year, quarterStartMonth + 3, 0),
    };
  }
  if (timeframe === "yearly") {
    return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
  }
  // custom
  if (customRange?.start && customRange?.end) {
    return { start: new Date(customRange.start), end: new Date(customRange.end) };
  }
  return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0) };
}
