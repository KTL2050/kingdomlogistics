import Link from "next/link";
import { ChevronRight, Ship, Truck, Home, AlertCircle, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Shipment } from "@/types";
import { cn, getCompanyForContainer } from "@/lib/utils";

const STATUS_ICON: Record<string, typeof Ship> = {
  "On the High Seas": Ship,
  "Enroute to Kampala": Truck,
  "At ICD": Home,
  "Mombasa Port": Ship,
  "Order Placed": AlertCircle,
  "Container Loaded": AlertCircle,
  "Arrived at Store": CheckCircle2,
};

export function ShipmentRow({ shipment }: { shipment: Shipment }) {
  const Icon = STATUS_ICON[shipment.currentStatus] ?? AlertCircle;
  const iconTone =
    shipment.health === "delayed" ? "text-danger" : "text-success";
  const company = getCompanyForContainer(shipment.containerNumber);
  const codeColor = company === "Aiwibi Uganda" ? "text-indigo-600" : "text-accent";

  return (
    <Link
      href={`/shipments/${shipment.containerNumber}`}
      className="flex items-center gap-2.5 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-page"
    >
      <div className="w-14 shrink-0">
        <div className={cn("text-sm font-semibold", codeColor)}>
          {shipment.containerNumber}
        </div>
        <div className="truncate text-[11px] text-text-tertiary">
          {shipment.routeVia.join(" → ")}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-text-primary">
          <Icon className={cn("h-3.5 w-3.5 shrink-0", iconTone)} />
          <span className="truncate">{shipment.currentStatus}</span>
        </div>
        <div className="truncate text-[11px] text-text-tertiary">
          {shipment.currentLocation}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-[11px] text-text-tertiary">ETA</div>
        <div className="text-[13px] font-medium text-text-primary">
          {shipment.finalEta.slice(8, 10)}{" "}
          {new Date(shipment.finalEta).toLocaleString("en-GB", {
            month: "short",
          })}
        </div>
      </div>

      <div className="w-[104px] shrink-0">
        <StatusBadge health={shipment.health} delayDays={shipment.delayDays} />
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" />
    </Link>
  );
}
