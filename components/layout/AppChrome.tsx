"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import type { Alert } from "@/types";

export function AppChrome({
  breadcrumb,
  title,
  subtitle,
  userName,
  userRole,
  alerts,
  orderPlanningDueCount = 0,
  children,
}: {
  breadcrumb: string;
  title: string;
  subtitle: string;
  userName: string;
  userRole: string;
  alerts: Alert[];
  orderPlanningDueCount?: number;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-page">
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          aria-hidden
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          alertCount={alerts.length}
          orderPlanningDueCount={orderPlanningDueCount}
          onCloseMobile={() => setMobileNavOpen(false)}
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
        />
        <main className="flex-1 px-4 py-4 sm:px-6">{children}</main>
      </div>
    </div>
  );
}