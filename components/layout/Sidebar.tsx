"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  Container,
  LayoutGrid,
  Package,
  Settings,
  BarChart3,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: LayoutGrid },
  { href: "/shipments", label: "Shipments", icon: Package },
  { href: "/", label: "Containers", icon: Container },
  { href: "/order-planning", label: "Order Planning", icon: CalendarClock },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  alertCount = 0,
  orderPlanningDueCount = 0,
  onCloseMobile,
}: {
  alertCount?: number;
  orderPlanningDueCount?: number;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col bg-sidebar transition-[width] duration-200 lg:sticky lg:top-0 lg:h-screen",
        collapsed ? "lg:w-[72px]" : "lg:w-[224px]",
        "w-[224px]"
      )}
    >
      <div className="flex h-14 items-center gap-2.5 px-4">
        <img
          src="https://ik.imagekit.io/6kafqkidx/logome.png"
          alt="Kingdom Trading Logistics"
          className="h-8 w-8 shrink-0 rounded-md object-contain"
        />
        {!collapsed && (
          <span className="truncate text-[15px] font-semibold text-white">
            Kingdom Trading Logistics
          </span>
        )}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            aria-label="Close menu"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-sidebar-text hover:bg-sidebar-hover hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="mt-2 flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
          const Icon = item.icon;
          const badge =
            item.href === "/alerts"
              ? alertCount
              : item.href === "/order-planning"
              ? orderPlanningDueCount
              : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors",
                isActive
                  ? "bg-sidebar-active text-sidebar-text-active"
                  : "text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active"
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {badge > 0 && (
                <span
                  className={cn(
                    "flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white",
                    collapsed ? "absolute -right-1 -top-1" : "ml-auto"
                  )}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="hidden border-t border-white/10 p-3 lg:block">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-sidebar-text-active"
        >
          <ChevronLeft
            className={cn(
              "h-[18px] w-[18px] shrink-0 transition-transform",
              collapsed && "rotate-180"
            )}
          />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}