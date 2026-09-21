import Link from "next/link";
import { ShipmentRow } from "@/components/dashboard/ShipmentRow";
import type { Shipment } from "@/types";

export function ShipmentStatusPanel({ shipments }: { shipments: Shipment[] }) {
  const visible = shipments.slice(0, 5);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[13.5px] font-semibold text-text-primary">
          Shipment status
        </h2>
        <Link
          href="/shipments"
          className="text-[12.5px] font-medium text-accent hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto">
        {visible.map((s) => (
          <ShipmentRow key={s.id} shipment={s} />
        ))}
      </div>

      <div className="border-t border-border px-4 py-2.5 text-center">
        <Link
          href="/shipments"
          className="text-[12.5px] font-medium text-accent hover:underline"
        >
          View all shipments ({shipments.length})
        </Link>
      </div>
    </div>
  );
}
