import { getCompanyForContainer } from "@/lib/utils";
import type { ContainerSize, OrderFrequency, PlannedOrder } from "@/types";

/**
 * Every header wording this parser recognizes for each field, already
 * normalized (lowercase, no spaces/punctuation) — see normalizeKey().
 * This is intentionally generous: a real spreadsheet or a PDF-exported
 * table almost never uses the exact wording you'd design from scratch,
 * so matching is alias-based first, then falls back to substring
 * containment (normalizeHeader) rather than requiring an exact hit.
 */
const FIELD_ALIASES: Record<string, string[]> = {
  container: [
    "container", "containerno", "containernumber", "containercode",
    "containerid", "cntr", "cntrno", "cntrnumber",
  ],
  size: ["size", "containersize", "ctrsize"],
  orderDate: [
    "orderdate", "date", "orderplaced", "placeddate", "dateordered",
    "duedate", "nextorderdate", "orderdue", "datedue",
  ],
  orderCycle: [
    "ordercycle", "cycle", "frequency", "orderfrequency", "recurrence",
    "interval", "ordertype",
  ],
  leadtime: [
    "leadtime", "lead", "notice", "noticeperiod", "leaddays", "leaddaysnotice",
  ],
  mombasaEta: ["mombasaeta", "etamombasa", "porteta", "eta"],
  storeDate: [
    "storedate", "deliverydate", "arrivaldate", "storearrival", "arrivalatstore",
  ],
  actual: ["actual", "actualdate", "placedon", "dateplaced", "orderplacedon"],
  status: ["status", "state"],
  notes: ["notes", "note", "remarks", "comment", "comments"],
};

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Maps a header cell's raw text to the canonical field name it means, or
 * undefined if it doesn't look like any recognized field. Tries an exact
 * alias match first; if that fails, falls back to "does this header
 * contain a known alias as a substring" (longest alias wins, so e.g. a
 * header matching both "eta" and "mombasaeta" resolves to the more
 * specific one) — this is what lets slightly-off real-world wording
 * ("Container No.", "Order Placed On") still get recognized.
 */
export function normalizeHeader(raw: string): string | undefined {
  const key = normalizeKey(raw);
  if (!key) return undefined;

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(key)) return field;
  }

  let bestField: string | undefined;
  let bestLen = 0;
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      if (key.includes(alias) && alias.length > bestLen) {
        bestField = field;
        bestLen = alias.length;
      }
    }
  }
  return bestField;
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

const CONTAINER_CODE_PATTERN = /^[A-Za-z]\d{1,5}$/;

function looksLikeContainerCode(text: string): boolean {
  return CONTAINER_CODE_PATTERN.test(text.trim());
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

const VALID_SIZES: ContainerSize[] = ["20ft", "40ft", "40ft HC", "45ft"];

function parseContainerSize(raw: unknown): ContainerSize | undefined {
  const text = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "");
  const match = VALID_SIZES.find((s) => s.toLowerCase().replace(/\s+/g, "") === text);
  return match;
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
 * Turns parsed rows into PlannedOrder records. `values` holds whatever
 * was matched by column header; `rawCells` (every cell in the row,
 * regardless of column) is a fallback for files with no recognizable
 * header row at all — common for a PDF export, or a spreadsheet someone
 * hand-formatted differently than expected. When a required field wasn't
 * found by header, this scans the raw cells for something that looks
 * like the right shape (a container-code pattern, a parseable date)
 * before giving up on that row. Each row becomes its own schedule — see
 * the upload UI's own note about one row per active order vs. full
 * history for the same container.
 */
export function buildPlannedOrdersFromRows(
  rows: { rowNumber: number; values: Record<string, unknown>; rawCells?: unknown[] }[]
): ImportRowResult[] {
  return rows.map(({ rowNumber, values, rawCells = [] }) => {
    let container = cleanCell(values.container).toUpperCase();
    if (!container) {
      const candidate = rawCells
        .map((c) => cleanCell(c).toUpperCase())
        .find((c) => looksLikeContainerCode(c));
      if (candidate) container = candidate;
    }
    if (!container) {
      return { rowNumber, error: "No container code found in this row" };
    }

    const company = getCompanyForContainer(container);
    if (company === "Unknown") {
      return {
        rowNumber,
        error: `Container "${container}" doesn't start with C (Uncle Bills) or A (Aiwibi Uganda)`,
      };
    }

    let anchorDate = parseFlexibleDate(values.orderDate);
    if (!anchorDate) {
      for (const cell of rawCells) {
        const parsed = parseFlexibleDate(cell);
        if (parsed) {
          anchorDate = parsed;
          break;
        }
      }
    }
    if (!anchorDate) {
      return { rowNumber, error: "No usable date found in this row" };
    }

    const { frequency, customIntervalDays } = parseOrderCycle(values.orderCycle);
    const leadTimeDays = parseLeadtime(values.leadtime);
    const containerSize = parseContainerSize(values.size);

    const order: PlannedOrder = {
      id: `po-import-${rowNumber}-${Date.now()}`,
      company,
      frequency,
      customIntervalDays: frequency === "custom" ? customIntervalDays : undefined,
      anchorDate,
      leadTimeDays,
      active: true,
      containerNumber: container,
      containerSize,
      notes: cleanCell(values.notes) || undefined,
      importedMombasaEta: cleanCell(values.mombasaEta) || undefined,
      importedStoreDate: cleanCell(values.storeDate) || undefined,
      importedActual: cleanCell(values.actual) || undefined,
    };

    return { rowNumber, order };
  });
}
