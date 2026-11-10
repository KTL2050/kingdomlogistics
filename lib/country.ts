import type { Country } from "@/types";

export const COUNTRIES: readonly Country[] = ["Uganda", "Kenya"];
export const COUNTRY_COOKIE = "ktl_country";

export function parseCountry(value: string | null | undefined): Country | null {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "kenya" || v === "ke") return "Kenya";
  if (v === "uganda" || v === "ug") return "Uganda";
  return null;
}

export const countrySlug = (c: Country) => (c === "Kenya" ? "ke" : "ug");

// The same code can exist in both countries, so a container's link always says which.
export function shipmentHref(s: { containerNumber: string; country: Country }) {
  return `/shipments/${encodeURIComponent(s.containerNumber)}?country=${countrySlug(s.country)}`;
}

// A user with a country set is fixed to it. Otherwise Admin, Logistics Manager
// and Operations Officer may choose; a Viewer with no country stays on Uganda.
export function resolveCountry(
  user: { country?: Country | null; role: string } | null,
  requested?: Country | null
): { country: Country; canSwitch: boolean } {
  if (user?.country) return { country: user.country, canSwitch: false };
  const canSwitch = Boolean(user) && user!.role !== "Viewer";
  return { country: canSwitch ? requested ?? "Uganda" : "Uganda", canSwitch };
}
