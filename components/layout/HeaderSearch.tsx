"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import type { Shipment } from "@/types";

export function HeaderSearch({ shipments }: { shipments: Shipment[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOrderPlanning = pathname === "/order-planning";

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Order Planning has no per-entry page to navigate to — search there
  // filters the already-visible table in place via the ?q= URL param,
  // instead of the dropdown-and-navigate behavior used everywhere else.
  useEffect(() => {
    setQuery(isOrderPlanning ? searchParams.get("q") ?? "" : "");
    setOpen(false);
  }, [isOrderPlanning, searchParams]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const matches = useMemo(() => {
    if (isOrderPlanning || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    return shipments
      .filter(
        (s) =>
          s.containerNumber.toLowerCase().includes(q) ||
          s.shipmentNumber.toLowerCase().includes(q) ||
          s.customer.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [shipments, query, isOrderPlanning]);

  function goToShipment(containerNumber: string) {
    router.push(`/shipments/${containerNumber}`);
    setQuery("");
    setOpen(false);
  }

  function handleChange(value: string) {
    setQuery(value);
    if (isOrderPlanning) {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    } else {
      setOpen(true);
    }
  }

  function handleKeyDownInput(e: React.KeyboardEvent<HTMLInputElement>) {
    if (isOrderPlanning) return;
    if (e.key === "Enter" && matches.length > 0) {
      goToShipment(matches[0].containerNumber);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative hidden w-56 shrink-0 lg:block xl:w-64">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => !isOrderPlanning && query.trim() && setOpen(true)}
        onKeyDown={handleKeyDownInput}
        placeholder={
          isOrderPlanning ? "Filter by company, notes or container" : "Search container, shipment or customer"
        }
        className="w-full rounded-lg border border-border bg-page py-1.5 pl-8 pr-10 text-[12.5px] text-text-primary placeholder:text-text-tertiary placeholder:truncate focus:border-accent focus:bg-surface focus:outline-none"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border-strong bg-surface px-1 py-0.5 text-[10px] text-text-tertiary">
        ⌘K
      </kbd>

      {!isOrderPlanning && open && query.trim() && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          {matches.length === 0 ? (
            <div className="px-3.5 py-4 text-center text-[12.5px] text-text-tertiary">
              No matches for &quot;{query}&quot;
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto py-1">
              {matches.map((s) => (
                <button
                  key={s.id}
                  onClick={() => goToShipment(s.containerNumber)}
                  className="flex w-full flex-col items-start px-3.5 py-2 text-left hover:bg-page"
                >
                  <span className="text-[12.5px] font-medium text-text-primary">
                    {s.containerNumber}
                    <span className="ml-1.5 font-normal text-text-tertiary">· {s.shipmentNumber}</span>
                  </span>
                  <span className="text-[11.5px] text-text-secondary">{s.customer}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
