import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import RestaurantPortalLogin from "@/components/auth/RestaurantPortalLogin";
import { CAPTAIN_SESSION_COOKIE, readAdminSession } from "@/lib/auth-core";
import { hasRestaurantFeature } from "@/lib/feature-access";
import { restaurantService } from "@/lib/services/restaurant.service";

export const dynamic = "force-dynamic";

export default async function RestaurantCaptainPortalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await restaurantService.getBySlug(slug);
  if (!restaurant || restaurant.isActive === false) notFound();
  if (!hasRestaurantFeature(restaurant, "CAPTAIN_ACCESS")) notFound();

  const cookieStore = await cookies();
  const session = await readAdminSession(
    cookieStore.get(CAPTAIN_SESSION_COOKIE)?.value,
    process.env.AUTH_SECRET,
  );
  if (session?.role === "CAPTAIN" && session.restaurantSlug === slug) {
    redirect(`/captain/${slug}`);
  }

  return (
    <RestaurantPortalLogin
      kind="captain"
      slug={restaurant.slug}
      restaurantName={restaurant.name}
    />
  );
}
