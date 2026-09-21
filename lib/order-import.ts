import { getCompanyForContainer } from "@/lib/utils";
import type { OrderFrequency, PlannedOrder } from "@/types";

/**
 * Maps the header text your spreadsheet actually uses (case/spacing may
 * vary) to the canonical field name this parser works with internally.
 */
const HEADER_ALIASES: Record<string, string> = {
  container: "container",
  "order date": "orderDate",
  "order cycle": "orderCycle",
  cycle: "orderCycle",
  leadtime: "leadtime",
  "lead time": "leadtime",
  "lead-time": "leadtime",
  "mombasa eta": "mombasaEta",
  "store date": "storeDate",
  actual: "actual",
  status: "status",
};

export function normalizeHeader(raw: string): string | undefined {
  return HEADER_ALIASES[raw.trim().toLowerCase()];
}

// Builds "YYYY-MM-DD" directly from calendar fields — never round-trips
// through a local-time Date + toISOString(), which silently shifts the
// date by a day whenever the machine's local timezone is ahead of UTC
// (midnight local time is the previous day in UTC).
function toIsoDateString(year: number, monthIndex: number, day: number): string | null {
  const d = new Date(year, monthIndex, day);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function parseFlexibleDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return toIsoDateString(raw.getFullYear(), raw.getMonth(), raw.getDate());
  }

  const text = String(raw).trim();
  if (!text) return null;

  // "20 Sep 2026" (what this app's own Excel export produces)
  const monthNames = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
  ];
  const dMonY = text.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (dMonY) {
    const monthIndex = monthNames.indexOf(dMonY[2].slice(0, 3).toLowerCase());
    if (monthIndex >= 0) {
      const iso = toIsoDateString(Number(dMonY[3]), monthIndex, Number(dMonY[1]));
      if (iso) return iso;
    }
  }

  // "2026-09-20"
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  // "20/09/2026" — day/month/year, matching en-GB formatting used
  // everywhere else in this app (not US month/day/year).
  const slash = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) {
    const [, day, month, y] = slash;
    const iso = toIsoDateString(Number(y), Number(month) - 1, Number(day));
    if (iso) return iso;
  }

  const fallback = new Date(text);
  if (!Number.isNaN(fallback.getTime())) {
    return toIsoDateString(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
  }
  return null;
}

function parseOrderCycle(raw: unknown): { frequency: OrderFrequency; customIntervalDays?: number } {
  const text = String(raw ?? "").trim().toLowerCase();
  if (text.includes("month")) return { frequency: "monthly" };
  if (text.includes("quarter")) return { frequency: "quarterly" };
  if (text.includes("year") || text.includes("annual")) return { frequency: "yearly" };

  // "Custom (45d)" or a bare number of days, e.g. "45"
  const days = text.match(/(\d+)/);
  return { frequency: "custom", customIntervalDays: days ? Number(days[1]) : 30 };
}

function parseLeadtime(raw: unknown): number {
  const days = String(raw ?? "").match(/(\d+)/);
  return days ? Number(days[1]) : 7;
}

function cleanCell(raw: unknown): string {
  const text = String(raw ?? "").trim();
  return text === "—" || text === "-" ? "" : text;
}

export interface ImportRowResult {
  rowNumber: number;
  order?: PlannedOrder;
  error?: string;
}

/**
 * Turns spreadsheet rows (one plain object per row, already keyed by the
 * canonical field names from normalizeHeader) into PlannedOrder records.
 * Each row becomes its own schedule — if your sheet has one row per
 * currently-active order per container, that's exactly right; if it has
 * full historical rows for the same container, you'll get one schedule
 * per row rather than one merged schedule (see note in the import modal).
 */
export function buildPlannedOrdersFromRows(
  rows: { rowNumber: number; values: Record<string, unknown> }[]
): ImportRowResult[] {
  return rows.map(({ rowNumber, values }) => {
    const container = cleanCell(values.container).toUpperCase();
    if (!container) {
      return { rowNumber, error: "Missing Container" };
    }

    const company = getCompanyForContainer(container);
    if (company === "Unknown") {
      return {
        rowNumber,
        error: `Container "${container}" doesn't start with C (Uncle Bills) or A (Aiwibi Uganda)`,
      };
    }

    const anchorDate = parseFlexibleDate(values.orderDate);
    if (!anchorDate) {
      return { rowNumber, error: `Couldn't read Order Date "${values.orderDate ?? ""}"` };
    }

    const { frequency, customIntervalDays } = parseOrderCycle(values.orderCycle);
    const leadTimeDays = parseLeadtime(values.leadtime);

    const order: PlannedOrder = {
      id: `po-import-${rowNumber}-${Date.now()}`,
      company,
      frequency,
      customIntervalDays: frequency === "custom" ? customIntervalDays : undefined,
      anchorDate,
      leadTimeDays,
      active: true,
      containerNumber: container,
      importedMombasaEta: cleanCell(values.mombasaEta) || undefined,
      importedStoreDate: cleanCell(values.storeDate) || undefined,
      importedActual: cleanCell(values.actual) || undefined,
    };

    return { rowNumber, order };
  });
}
