import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  icon: Icon,
  label,
  value,
  supporting,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  supporting: string;
  tone: "accent" | "success" | "danger" | "warning";
}) {
  const toneStyles: Record<typeof tone, { bg: string; text: string }> = {
    accent: { bg: "bg-accent-soft", text: "text-accent" },
    success: { bg: "bg-success-soft", text: "text-success" },
    danger: { bg: "bg-danger-soft", text: "text-danger" },
    warning: { bg: "bg-warning-soft", text: "text-warning" },
  };
  const style = toneStyles[tone];

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          style.bg
        )}
      >
        <Icon className={cn("h-[18px] w-[18px]", style.text)} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <div className="text-[12.5px] text-text-secondary">{label}</div>
        <div className="text-[22px] font-semibold leading-tight text-text-primary">
          {value}
        </div>
        <div className="truncate text-[11px] text-text-tertiary">{supporting}</div>
      </div>
    </div>
  );
}
