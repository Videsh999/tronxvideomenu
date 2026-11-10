import { redirect } from "next/navigation";
import { requireCaptain } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function CaptainHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain();
  if (error || !captain || !restaurant) redirect("/captain/login");
  redirect(`/captain/${restaurant.slug === slug ? slug : restaurant.slug}/tables`);
}
