import { notFound, redirect } from "next/navigation";
import RestaurantEditor from "@/components/super-admin/RestaurantEditor";
import AccessAssignmentPanel from "@/components/super-admin/AccessAssignmentPanel";
import { getSuperAdminContext } from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";

export const dynamic = "force-dynamic";

export default async function EditRestaurantPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const context = await getSuperAdminContext();
  if (!context || context.role !== "SUPER_ADMIN")
    redirect("/super-admin/login");

  const { restaurantId } = await params;
  const restaurant = await restaurantService.getById(restaurantId);
  if (!restaurant) notFound();
  return (
    <div className="space-y-6">
      <RestaurantEditor restaurant={restaurant} />
      <AccessAssignmentPanel
        restaurantId={restaurant.id}
        organizationId={restaurant.organizationId}
      />
    </div>
  );
}
