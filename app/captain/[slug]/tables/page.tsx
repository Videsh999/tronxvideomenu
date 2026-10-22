import { redirect } from "next/navigation";
import { requireCaptain } from "@/lib/auth-server";
import { tableService } from "@/lib/services/table.service";
import CaptainTables from "@/components/captain/CaptainTables";

export const dynamic = "force-dynamic";

export default async function CaptainTablesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { captain, restaurant, error } = await requireCaptain("TABLE_MANAGEMENT");
  if (error || !captain || !restaurant) redirect(`/captain/${slug}`);
  if (restaurant.slug !== slug) redirect(`/captain/${restaurant.slug}`);
  return <CaptainTables initialTables={await tableService.list(captain.restaurantId)} />;
}
