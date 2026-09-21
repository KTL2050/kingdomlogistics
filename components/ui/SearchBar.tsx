"use client";

import { Search } from "lucide-react";

export function SearchBar({
  placeholder = "Search container, shipment or PO",
  onChange,
  value,
}: {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="relative hidden w-56 shrink-0 lg:block xl:w-64">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-page py-1.5 pl-8 pr-10 text-[12.5px] text-text-primary placeholder:text-text-tertiary placeholder:truncate focus:border-accent focus:bg-surface focus:outline-none"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border-strong bg-surface px-1 py-0.5 text-[10px] text-text-tertiary">
        ⌘K
      </kbd>
    </div>
  );
}
