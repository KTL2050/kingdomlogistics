"use client";

import { cn } from "@/lib/utils";

export function FilterTabs({
  options,
  active,
  onChange,
}: {
  options: string[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-page p-1">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors",
            active === option
              ? "bg-surface text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
