import { AppShell } from "@/components/layout/AppShell";
import { OrderPlanningView } from "@/components/order-planning/OrderPlanningView";
import { getCurrentUser, getPlannedOrders, getShipments } from "@/lib/data";

const MANAGER_ROLES = ["Admin", "Logistics Manager", "Operations Officer"];

export default async function OrderPlanningPage() {
  const [plannedOrders, shipments, user] = await Promise.all([
    getPlannedOrders(),
    getShipments(),
    getCurrentUser(),
  ]);

  return (
    <AppShell
      breadcrumb="Logistics / Order Planning"
      title="Order Planning"
      subtitle="When Uncle Bills and Aiwibi Uganda need their next order placed"
    >
      <OrderPlanningView
        plannedOrders={plannedOrders}
        shipments={shipments}
        canManage={Boolean(user && MANAGER_ROLES.includes(user.role))}
      />
    </AppShell>
  );
}
