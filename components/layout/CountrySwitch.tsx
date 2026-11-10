"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { COUNTRIES } from "@/lib/country";
import { setCountryChoice } from "@/app/country-actions";
import type { Country } from "@/types";

export function CountrySwitch({ country, canSwitch }: { country: Country; canSwitch: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  if (!canSwitch) {
    return (
      <span className="rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-text-secondary">
        {country}
      </span>
    );
  }

  async function choose(next: Country) {
    if (next === country) return;
    await setCountryChoice(next);
    // A container's page belongs to one country, so switching leaves it for the list.
    if (/^\/shipments\/[^/]+/.test(pathname)) router.push("/shipments");
    else router.refresh();
  }

  return (
    <div
      role="group"
      aria-label="Country"
      className="flex shrink-0 overflow-hidden rounded-lg border border-border text-[12px] font-medium"
    >
      {COUNTRIES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => choose(c)}
          aria-pressed={c === country}
          className={cn(
            "px-2.5 py-1.5",
            c === country ? "bg-accent text-white" : "text-text-secondary hover:bg-page"
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
