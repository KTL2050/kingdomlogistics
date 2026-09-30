"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import type { Alert, Shipment } from "@/types";

export function AppChrome({
  breadcrumb,
  title,
  subtitle,
  userName,
  userRole,
  alerts,
  orderPlanningDueCount = 0,
  headerAction,
  shipments,
  children,
}: {
  breadcrumb: string;
  title: string;
  subtitle: string;
  userName: string;
  userRole: string;
  alerts: Alert[];
  orderPlanningDueCount?: number;
  headerAction?: React.ReactNode;
  shipments: Shipment[];
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-page">
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-[1100] bg-black/30 lg:hidden"
          aria-hidden
        />
      )}

      {/* z-[1200] — Leaflet's own default stylesheet puts its control
          corners (and the custom map overlays in TrackingMapInner.tsx)
          at z-index 1000, which sat above this drawer's old z-50 and let
          the map render on top of the open mobile menu. Matches the
          z-[1200] this app already uses for modal overlays (e.g.
          AddContainerModal.tsx), so it's consistently the top layer. */}
      <div
        className={`fixed inset-y-0 left-0 z-[1200] transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          alertCount={alerts.length}
          orderPlanningDueCount={orderPlanningDueCount}
          onCloseMobile={() => setMobileNavOpen(false)}
          userRole={userRole}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          breadcrumb={breadcrumb}
          title={title}
          subtitle={subtitle}
          userName={userName}
          userRole={userRole}
          alerts={alerts}
          onMenuClick={() => setMobileNavOpen(true)}
          headerAction={headerAction}
          shipments={shipments}
        />
        <main className="flex-1 px-4 py-4 sm:px-6">{children}</main>
      </div>
    </div>
  );
}