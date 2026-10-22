import { redirect } from "next/navigation";
import CaptainNavigation from "@/components/captain/CaptainNavigation";
import { requireCaptain } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function CaptainLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { restaurant, error } = await requireCaptain();
  if (error || !restaurant) redirect("/captain/login");
  if (restaurant.slug !== slug) redirect(`/captain/${restaurant.slug}`);
  return <div className="console min-h-screen text-neutral-900 selection:bg-neutral-200 lg:flex">
    <CaptainNavigation slug={restaurant.slug} restaurantName={restaurant.name} />
    <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:py-8"><div className="mx-auto max-w-6xl animate-fade-up">{children}</div></main>
  </div>;
}
