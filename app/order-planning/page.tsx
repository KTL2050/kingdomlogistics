import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { OrderPlanningView } from "@/components/order-planning/OrderPlanningView";
import { getActiveCountry, getCurrentUser, getPlannedOrders, getShipments } from "@/lib/data";

const MANAGER_ROLES = ["Admin", "Logistics Manager", "Operations Officer"];

export default async function OrderPlanningPage() {
  const [plannedOrders, shipments, user, { country }] = await Promise.all([
    getPlannedOrders(),
    getShipments(),
    getCurrentUser(),
    getActiveCountry(),
  ]);

  if (user?.role === "Viewer") redirect("/");

  return (
    <AppShell
      breadcrumb="Logistics / Order Planning"
      title="Order Planning"
      subtitle={`When Uncle Bills and Aiwibi ${country} need their next order placed`}
    >
      <OrderPlanningView
        key={country}
        country={country}
        plannedOrders={plannedOrders}
        shipments={shipments}
        canManage={Boolean(user && MANAGER_ROLES.includes(user.role))}
      />
    </AppShell>
  );
}
