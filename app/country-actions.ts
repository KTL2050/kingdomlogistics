"use server";

import { cookies } from "next/headers";
import { COUNTRY_COOKIE, parseCountry } from "@/lib/country";

// Remembers which country a user was last viewing. Only a choice — a user
// who is fixed to one country is held to it by resolveCountry() whatever
// this says.
export async function setCountryChoice(value: string): Promise<void> {
  const country = parseCountry(value);
  if (!country) return;
  (await cookies()).set(COUNTRY_COOKIE, country, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });
}
