import { redirect } from "next/navigation";
import { AppChrome } from "@/components/layout/AppChrome";
import { PendingApproval } from "@/components/auth/PendingApproval";
import { getAlerts, getCurrentUser, getPlannedOrders, getShipments } from "@/lib/data";
import { getDueSoonOrders } from "@/lib/order-planning";

export async function AppShell({
  breadcrumb,
  title,
  subtitle,
  headerAction,
  children,
}: {
  breadcrumb: string;
  title: string;
  subtitle: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.status !== "approved") {
    return <PendingApproval email={user.email} />;
  }

  const [allAlerts, plannedOrders, shipments] = await Promise.all([
    getAlerts(),
    getPlannedOrders(),
    getShipments(),
  ]);
  const unacknowledged = allAlerts.filter((a) => !a.acknowledged);
  const orderPlanningDueCount = getDueSoonOrders(plannedOrders).length;

  return (
    <AppChrome
      breadcrumb={breadcrumb}
      title={title}
      subtitle={subtitle}
      userName={user.fullName}
      userRole={user.role}
      alerts={unacknowledged}
      orderPlanningDueCount={orderPlanningDueCount}
      headerAction={headerAction}
      shipments={shipments}
    >
      {children}
    </AppChrome>
  );
}