import { notFound } from "next/navigation";
import TablesManager from "@/components/admin/TablesManager";
import { tableService } from "@/lib/services/table.service";
import { orderService } from "@/lib/services/order.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function RestaurantTablesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant || !requireRestaurantFeature(restaurant, "TABLE_MANAGEMENT").allowed) notFound();
  const orderManagementEnabled = requireRestaurantFeature(restaurant, "ORDER_MANAGEMENT").allowed;
  const tableOrderingEnabled = requireRestaurantFeature(restaurant, "TABLE_ORDERING").allowed;
  const [initialTables, initialOrders] = await Promise.all([
    tableService.list(slug),
    orderManagementEnabled ? orderService.listForRestaurant(slug) : Promise.resolve([]),
  ]);
  return <TablesManager initialTables={initialTables} initialOrders={initialOrders} restaurantSlug={slug} restaurantName={restaurant.name} orderManagementEnabled={orderManagementEnabled} tableOrderingEnabled={tableOrderingEnabled} />;
}
