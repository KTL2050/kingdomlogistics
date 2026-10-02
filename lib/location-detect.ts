/**
 * Best-effort guess at which of the remaining inland stages a manager's
 * free-text location description refers to — e.g. "on its way to ICD"
 * should resolve to the stage BEFORE "At ICD" (still in transit), while
 * "arrived at the ICD" should resolve to "At ICD" itself. This is a
 * helper, not an authority — the form always shows the result as an
 * editable dropdown, so a wrong guess costs one click, not a silent bad
 * record on the shipment.
 */

const STAGE_KEYWORDS: Record<string, string[]> = {
  "Enroute to Kampala": [
    "enroute", "en route", "kampala", "transit", "transporting",
    "on route", "on the road", "highway", "border", "malaba",
  ],
  "At ICD": ["icd", "inland container depot", "depot"],
  "Arrived at Store": ["store", "warehouse", "delivered", "destination", "ntinda"],
};

const IN_TRANSIT_SIGNALS = [
  "on its way", "on the way", "heading", "towards", "toward", "coming to",
  "approaching", "near", "enroute to", "en route to", "going to", "still on route to",
];

const ARRIVAL_SIGNALS = ["arrived", "reached", "at the", "now at", "has reached"];

/**
 * Returns the index (within `steps`, searching from `fromIndex` onward)
 * of the stage the free text most likely refers to, or null if nothing
 * recognizable was mentioned at all.
 */
export function detectStageIndex(
  freeText: string,
  steps: readonly string[],
  fromIndex: number
): number | null {
  const text = freeText.toLowerCase();
  if (!text.trim()) return null;

  const candidates: number[] = [];
  for (let i = fromIndex; i < steps.length; i++) {
    const keywords = STAGE_KEYWORDS[steps[i]] ?? [];
    if (keywords.some((k) => text.includes(k))) candidates.push(i);
  }
  if (candidates.length === 0) return null;

  // Prefer the furthest-along stage mentioned — "left ICD, heading to
  // the store" should resolve to the store, not ICD.
  let best = candidates[candidates.length - 1];

  const inTransit = IN_TRANSIT_SIGNALS.some((s) => text.includes(s));
  const arrived = ARRIVAL_SIGNALS.some((s) => text.includes(s));
  if (inTransit && !arrived && best > fromIndex) {
    best -= 1;
  }

  return best;
}
