import { redirect } from "next/navigation";
import CaptainFloor from "@/components/captain/CaptainFloor";
import { requireCaptain } from "@/lib/auth-server";
import { loadCaptainFloor } from "@/lib/captain-floor-load";

export const dynamic = "force-dynamic";

export default async function CaptainTablesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain("TABLE_MANAGEMENT");
  if (error || !captain || !restaurant) redirect(`/captain/${slug}`);
  if (restaurant.slug !== slug) redirect(`/captain/${restaurant.slug}`);

  const floor = await loadCaptainFloor(captain.restaurantId, restaurant.slug);
  return (
    <CaptainFloor
      slug={restaurant.slug}
      captainName={captain.name}
      permissions={captain.permissions}
      initialTables={floor.tables}
      initialOrders={floor.orders}
      categories={floor.categories}
      dishes={floor.dishes}
    />
  );
}
