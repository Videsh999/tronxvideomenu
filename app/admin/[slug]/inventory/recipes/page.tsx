import { notFound } from "next/navigation";
import RecipeEditor from "@/components/admin/RecipeEditor";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const dynamic = "force-dynamic";

export default async function RecipesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const menu = await restaurantService.getFullMenu(slug);
  if (!menu || !requireRestaurantFeature(menu.restaurant, "INVENTORY").allowed) notFound();
  return <RecipeEditor restaurantName={menu.restaurant.name} dishes={menu.dishes} />;
}
