import { cn, healthBadgeLabel, healthStyles } from "@/lib/utils";
import type { ShipmentHealth } from "@/types";

export function StatusBadge({
  health,
  delayDays,
}: {
  health: ShipmentHealth;
  delayDays: number;
}) {
  const style = healthStyles[health];
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium",
        style.bg,
        style.text
      )}
    >
      {healthBadgeLabel(health, delayDays)}
    </span>
  );
}
